pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories { mavenCentral() }
}

rootProject.name = "wordlight-bible"
include(":shared", ":server", ":web")
