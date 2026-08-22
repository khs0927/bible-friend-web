package com.wordlight.server

import com.wordlight.shared.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.http.content.*
import kotlinx.serialization.json.Json

private object BibleRepository {
    private val verses = listOf(
        Verse("jn-3-16", "요한복음 3:16", "하나님이 세상을 사랑하셔서 독생자를 주셨습니다.", "요한복음", 3, 16, listOf("사랑", "복음", "구원"), "하나님의 사랑은 감정에 머물지 않고 우리에게 먼저 다가오는 사랑입니다."),
        Verse("ps-23-1", "시편 23:1", "여호와는 나의 목자시니 내게 부족함이 없습니다.", "시편", 23, 1, listOf("평안", "인도하심", "신뢰"), "오늘 필요한 모든 것을 혼자 붙잡기보다 목자 되시는 하나님께 맡겨 보세요."),
        Verse("php-4-6", "빌립보서 4:6", "아무것도 염려하지 말고 모든 일을 기도와 간구로 하나님께 아뢰십시오.", "빌립보서", 4, 6, listOf("기도", "평안", "염려"), "걱정을 없애려 하기보다 걱정을 기도의 문으로 바꾸어 보세요."),
        Verse("isa-41-10", "이사야 41:10", "두려워하지 마십시오. 하나님이 함께하시고 붙드십니다.", "이사야", 41, 10, listOf("용기", "동행", "두려움"), "두려움보다 하나님의 임재가 더 크다는 사실을 천천히 마음에 새겨 보세요."),
        Verse("rom-8-28", "로마서 8:28", "하나님을 사랑하는 자들에게 모든 것이 합력하여 선을 이룹니다.", "로마서", 8, 28, listOf("소망", "신뢰", "인내"), "지금 이해되지 않는 일도 하나님 안에서는 완성되지 않은 한 장면일 수 있습니다."),
        Verse("mt-11-28", "마태복음 11:28", "수고하고 무거운 짐 진 자들은 예수님께 나아오십시오. 쉼을 주십니다.", "마태복음", 11, 28, listOf("쉼", "위로", "예수님"), "쉬는 것은 포기가 아니라 예수님께 짐을 옮겨 드리는 믿음의 행동이 될 수 있습니다."),
        Verse("prv-3-5", "잠언 3:5", "마음을 다하여 여호와를 신뢰하고 자신의 명철만 의지하지 마십시오.", "잠언", 3, 5, listOf("지혜", "신뢰", "인도하심"), "결정을 앞두고 있다면 내 계산과 함께 하나님의 뜻을 묻는 시간을 가져 보세요."),
        Verse("gal-5-22", "갈라디아서 5:22", "성령의 열매는 사랑과 희락과 화평과 오래 참음과 자비와 양선과 충성입니다.", "갈라디아서", 5, 22, listOf("성령", "성장", "사랑"), "신앙의 성장은 더 많이 아는 것만이 아니라 삶에서 열매가 나타나는 것입니다."),
        Verse("heb-11-1", "히브리서 11:1", "믿음은 바라는 것들의 실상이요 보이지 않는 것들의 증거입니다.", "히브리서", 11, 1, listOf("믿음", "소망", "인내"), "보이지 않아도 하나님을 신뢰하며 오늘 해야 할 작은 순종을 선택해 보세요."),
        Verse("1pe-4-8", "베드로전서 4:8", "무엇보다 서로 뜨겁게 사랑하십시오. 사랑은 많은 허물을 덮습니다.", "베드로전서", 4, 8, listOf("사랑", "관계", "용서"), "사랑은 상대의 잘못을 모른 척하는 것이 아니라 회복을 향해 품는 태도입니다."),
        Verse("jos-1-9", "여호수아 1:9", "강하고 담대하십시오. 어디로 가든 하나님이 함께하십니다.", "여호수아", 1, 9, listOf("용기", "동행", "사명"), "용기는 두려움이 없는 상태가 아니라 하나님과 함께 두려움 속에서도 걷는 것입니다."),
        Verse("jn-14-27", "요한복음 14:27", "예수님이 주시는 평안은 세상이 주는 것과 다릅니다.", "요한복음", 14, 27, listOf("평안", "예수님", "위로"), "환경이 바뀌기 전에 마음 깊은 곳에서 시작되는 평안을 구해 보세요.")
    )

    fun all(): List<Verse> = verses
    fun byId(id: String) = verses.find { it.id == id }
    fun search(query: String?, topic: String?, limit: Int): List<Verse> {
        val q = query?.trim()?.lowercase().orEmpty()
        val t = topic?.trim()?.lowercase().orEmpty()
        return verses.asSequence()
            .filter { v -> q.isBlank() || listOf(v.reference, v.text, v.book, v.reflection).any { it.lowercase().contains(q) } || v.topics.any { it.lowercase().contains(q) } }
            .filter { v -> t.isBlank() || v.topics.any { it.lowercase() == t } }
            .take(limit.coerceIn(1, 50))
            .toList()
    }

    fun topics(): List<Topic> {
        val descriptions = mapOf(
            "사랑" to "하나님의 사랑과 관계 회복", "평안" to "염려 속에서도 누리는 쉼", "기도" to "하나님께 마음을 올려드리는 시간",
            "믿음" to "보이지 않아도 신뢰하는 걸음", "용기" to "두려움보다 큰 하나님의 동행", "소망" to "끝이 아닌 하나님의 다음 장면",
            "성령" to "삶에서 맺히는 성령의 열매", "인내" to "기다림 속에서 자라는 믿음"
        )
        val emojis = mapOf("사랑" to "❤", "평안" to "☁", "기도" to "🙏", "믿음" to "✦", "용기" to "🛡", "소망" to "🌱", "성령" to "🕊", "인내" to "⏳")
        return verses.flatMap { it.topics }.groupingBy { it }.eachCount()
            .filterKeys { it in descriptions }
            .map { (name, count) -> Topic(name, name, descriptions[name].orEmpty(), emojis[name] ?: "✧", count) }
            .sortedByDescending { it.count }
    }

    fun daily(): DailyVerse {
        val index = java.time.LocalDate.now().dayOfYear % verses.size
        val verse = verses[index]
        return DailyVerse(
            verse,
            "오늘 하루, '${verse.topics.first()}'이라는 단어를 마음에 품고 작은 한 걸음을 실천해 보세요.",
            "하나님, 오늘 말씀을 지식으로만 지나치지 않고 제 생각과 말과 행동 속에서 살아내게 해주세요. 아멘."
        )
    }
}

fun Application.module() {
    install(CallLogging)
    install(ContentNegotiation) {
        json(Json { prettyPrint = true; ignoreUnknownKeys = true })
    }

    routing {
        route("/api") {
            get("/health") { call.respond(HealthResponse(true, "wordlight-bible", "0.1.0")) }
            get("/bootstrap") {
                call.respond(BootstrapPayload(BibleRepository.daily(), BibleRepository.topics(), BibleRepository.all().take(6)))
            }
            get("/today") { call.respond(BibleRepository.daily()) }
            get("/topics") { call.respond(BibleRepository.topics()) }
            get("/verses") {
                val q = call.request.queryParameters["q"]
                val topic = call.request.queryParameters["topic"]
                val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 24
                call.respond(BibleRepository.search(q, topic, limit))
            }
            get("/verses/{id}") {
                val verse = call.parameters["id"]?.let(BibleRepository::byId)
                if (verse == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "verse_not_found")) else call.respond(verse)
            }
        }

        staticResources("/", "static", index = "index.html")
    }
}

fun main(args: Array<String>): Unit = io.ktor.server.netty.EngineMain.main(args)
