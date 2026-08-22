package com.wordlight.shared

import kotlinx.serialization.Serializable

@Serializable
data class Verse(
    val id: String,
    val reference: String,
    val text: String,
    val book: String,
    val chapter: Int,
    val verse: Int,
    val topics: List<String>,
    val reflection: String
)

@Serializable
data class Topic(
    val id: String,
    val title: String,
    val description: String,
    val emoji: String,
    val count: Int
)

@Serializable
data class DailyVerse(
    val verse: Verse,
    val message: String,
    val prayer: String
)

@Serializable
data class BootstrapPayload(
    val daily: DailyVerse,
    val topics: List<Topic>,
    val featured: List<Verse>
)

@Serializable
data class HealthResponse(val ok: Boolean, val service: String, val version: String)
