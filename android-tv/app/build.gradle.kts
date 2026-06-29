plugins {
    id("com.android.application") version "8.2.0"
    id("org.jetbrains.kotlin.android") version "1.9.22"
}

android {
    namespace = "com.kvideo"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.kvideo"
        minSdk = 21
        targetSdk = 34
        versionCode = 7
        versionName = "2.3.0"
    }

    flavorDimensions += "target"
    productFlavors {
        create("tv") {
            dimension = "target"
            applicationId = "com.kvideo.tv"
            versionNameSuffix = "-tv"
            manifestPlaceholders["appLabel"] = "NB影视"
            manifestPlaceholders["appOrientation"] = "landscape"
        }
        create("mobile") {
            dimension = "target"
            applicationId = "com.kvideo.mobile"
            versionNameSuffix = "-mobile"
            manifestPlaceholders["appLabel"] = "NB影视"
            manifestPlaceholders["appOrientation"] = "unspecified"
        }
    }

    signingConfigs {
        create("release") {
            storeFile = file("../keystore/ks.jks")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Enable core library desugaring for Java 8+ API compatibility on older Android
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Core library desugaring - enables java.time, java.util.function, etc. on API < 26
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")

    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("androidx.webkit:webkit:1.9.0")
    implementation("androidx.tvprovider:tvprovider:1.1.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    // 腾讯X5 TBS内核 - 替代系统WebView，国产电视兼容性最佳
    implementation("com.tencent.tbs:tbssdk:44286")
}
