plugins {
    kotlin("multiplatform")
    kotlin("plugin.serialization")
}

kotlin {
    js {
        browser {
            commonWebpackConfig {
                outputFileName = "wordlight.js"
            }
        }
        binaries.executable()
    }

    sourceSets {
        jsMain.dependencies {
            implementation(project(":shared"))
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
        }
    }
}
