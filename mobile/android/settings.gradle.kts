pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // JitPack for additional libraries if needed
        maven { url = uri("https://jitpack.io") }
    }
}

rootProject.name = "FlowLink"
include(":app")

