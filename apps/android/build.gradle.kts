plugins {
    alias(libs.plugins.android.application) apply false
    // On the classpath so AGP's built-in Kotlin uses this version, matching the compose plugin
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}
