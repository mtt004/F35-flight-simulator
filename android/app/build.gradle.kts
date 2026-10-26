plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val bundledWeb = layout.buildDirectory.dir("generated/lightningAssets")
val bundleWeb by tasks.registering(Sync::class) {
    from(rootProject.file("../dist/index.html"))
    into(bundledWeb.map { it.dir("www") })
    doFirst {
        check(rootProject.file("../dist/index.html").isFile) {
            "Browser build missing: run node scripts/build-web.mjs from the repository root first"
        }
    }
}

android {
    buildFeatures { buildConfig = true }
    namespace = "com.mtt004.lightning"
    compileSdk = 35
    buildToolsVersion = "35.0.0"
    defaultConfig {
        applicationId = "com.mtt004.lightning"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-experimental"
        testInstrumentationRunner = "android.test.InstrumentationTestRunner"
    }
    sourceSets.getByName("main").assets.srcDir(bundledWeb)
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
        }
        getByName("debug") {
            isDebuggable = true
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    lint { abortOnError = true }
}
tasks.named("preBuild") { dependsOn(bundleWeb) }
dependencies { implementation("androidx.webkit:webkit:1.12.1") }
