#!/usr/bin/env python3
"""Synthetic regression checks for the LiDAR roof estimator and raster alignment."""
import importlib.util
from pathlib import Path
import unittest

import numpy as np
from rasterio.io import MemoryFile
from rasterio.transform import from_origin

spec = importlib.util.spec_from_file_location('heights', Path(__file__).with_name('build-london-heights.py'))
heights = importlib.util.module_from_spec(spec)
spec.loader.exec_module(heights)


class EstimateTests(unittest.TestCase):
    def estimate(self, delta, mask=None):
        delta = np.asarray(delta, dtype=float)
        base = np.full(delta.shape, 30.)
        dsm = np.ma.array(base + delta, mask=mask)
        return heights.estimate_samples(dsm, np.ma.array(base), np.ones(delta.shape, bool))

    def test_isolated_tree_and_antenna_returns_do_not_raise_roof(self):
        delta = np.full((10, 10), 18.)
        delta.flat[:8] = [100, 70, 45, 38, 200, 60, 80, 55]
        result, reason = self.estimate(delta)
        self.assertIsNone(reason)
        self.assertEqual(result['height'], 18)
        self.assertEqual(result['base'], 30)
        self.assertEqual(result['samples'], 92)
        self.assertEqual(result['rejectedSamples'], 8)

    def test_tall_roof_has_no_arbitrary_ceiling(self):
        result, reason = self.estimate(np.full((10, 10), 352.7))
        self.assertIsNone(reason)
        self.assertEqual(result['height'], 352.7)

    def test_nodata_and_nonfinite_cannot_become_a_height(self):
        delta = np.full((10, 10), 20.)
        delta.flat[:10] = np.nan
        mask = np.zeros((10, 10), bool)
        mask.flat[10:50] = True
        result, reason = self.estimate(delta, mask)
        self.assertIsNone(result)
        self.assertEqual(reason, 'insufficient-valid-interior')

    def test_adequate_partial_nodata_retains_measured_provenance(self):
        mask = np.zeros((10, 10), bool)
        mask.flat[:10] = True
        result, reason = self.estimate(np.full((10, 10), 20.), mask)
        self.assertIsNone(reason)
        self.assertEqual(result['source'], heights.SOURCE)
        self.assertEqual(result['samples'], 90)
        self.assertEqual(result['validFraction'], .9)

    def test_low_and_sparse_returns_explicitly_fall_back(self):
        result, reason = self.estimate(np.zeros((10, 10)))
        self.assertIsNone(result)
        self.assertEqual(reason, 'insufficient-roof-support')
        result, reason = self.estimate(np.full((2, 2), 18.))
        self.assertIsNone(result)
        self.assertEqual(reason, 'insufficient-valid-interior')
        record = heights.fallback({'h': 24}, reason)
        self.assertEqual(record['height'], 24)
        self.assertEqual(record['samples'], 0)
        self.assertEqual(record['confidence'], 'fallback')
        self.assertIsNone(record['base'])

    def test_real_grid_transform_interior_mask_avoids_edge_trees(self):
        # Game origin is E507000 N176000; building is a 20 m square.
        building = {'p': [[0,0],[20,0],[20,20],[0,20],[0,0]], 'h':12}
        transform = from_origin(507000,176000,1,1)
        base = np.full((20,20), 7., dtype='float32')
        dsm = base + 15
        dsm[:2,:] = 80
        dsm[-2:,:] = 80
        dsm[:,:2] = 80
        dsm[:,-2:] = 80
        profile = {'driver':'GTiff','height':20,'width':20,'count':1,
                   'dtype':'float32','crs':'EPSG:27700','transform':transform,
                   'nodata':-9999.}
        with MemoryFile() as ma, MemoryFile() as mb:
            with ma.open(**profile) as da, mb.open(**profile) as db:
                da.write(dsm,1)
                db.write(base,1)
                result, reason = heights.measure(building,da,db)
        self.assertIsNone(reason)
        self.assertEqual(result['height'], 15)
        self.assertEqual(result['base'], 7)
        self.assertEqual(result['insetM'], 1.5)

    def test_holes_are_excluded(self):
        building = {'p':[[0,0],[30,0],[30,30],[0,30],[0,0]],
                    'holes': [[[10,10],[20,10],[20,20],[10,20],[10,10]]]}
        polygon = heights.footprint(building)
        self.assertAlmostEqual(polygon.area,800)
        self.assertEqual(polygon.bounds,(507000,175970,507030,176000))


if __name__ == '__main__':
    unittest.main()
