// Plain Kotlin, no Android: models, API client, search and parsing, tested on the JVM
plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

kotlin { jvmToolchain(17) }

dependencies {
    implementation(libs.kotlinx.coroutines.core)
    api(libs.kotlinx.serialization.json)
    api(libs.okhttp)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
}

// The shared API fixture, the contract the website and iOS app test against too
tasks.test {
    systemProperty("fixtures", rootProject.file("../../shared/fixtures").absolutePath)
}
