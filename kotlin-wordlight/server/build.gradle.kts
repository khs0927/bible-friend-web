plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
    id("io.ktor.plugin")
    application
}

kotlin { jvmToolchain(21) }

application {
    mainClass.set("com.wordlight.server.ApplicationKt")
}

dependencies {
    implementation(project(":shared"))
    implementation("io.ktor:ktor-server-core:3.5.2")
    implementation("io.ktor:ktor-server-netty:3.5.2")
    implementation("io.ktor:ktor-server-content-negotiation:3.5.2")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.5.2")
    implementation("io.ktor:ktor-server-call-logging:3.5.2")
    implementation("ch.qos.logback:logback-classic:1.5.18")
    testImplementation(kotlin("test"))
    testImplementation("io.ktor:ktor-server-test-host:3.5.2")
}

tasks.processResources {
    dependsOn(":web:jsBrowserDistribution")
    from(project(":web").layout.buildDirectory.dir("dist/js/productionExecutable")) {
        into("static")
    }
}
