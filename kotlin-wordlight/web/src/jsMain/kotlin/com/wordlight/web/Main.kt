package com.wordlight.web

import com.wordlight.shared.*
import kotlinx.browser.document
import kotlinx.browser.localStorage
import kotlinx.browser.window
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.await
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import org.w3c.dom.*
import org.w3c.fetch.Response

private val scope = MainScope()
private val json = Json { ignoreUnknownKeys = true }
private var bootstrap: BootstrapPayload? = null
private var currentVerses: List<Verse> = emptyList()
private val savedIds = mutableSetOf<String>()

fun main() {
    loadSaved()
    renderLoading()
    scope.launch {
        runCatching {
            val data = fetchJson<BootstrapPayload>("/api/bootstrap", BootstrapPayload.serializer())
            bootstrap = data
            currentVerses = data.featured
            renderApp(data)
        }.onFailure { renderError(it.message ?: "데이터를 불러오지 못했습니다.") }
    }
}

private fun renderLoading() {
    document.getElementById("app")?.innerHTML = """
      <main class="shell"><nav class="nav"><div class="brand"><span class="brand-mark">✦</span> WordLight</div></nav>
      <section class="hero"><div><span class="eyebrow">Kotlin Full Stack Bible</span><h1>말씀으로 하루를<br/><em>밝히는 공간</em></h1><p>말씀을 불러오는 중입니다…</p></div></section></main>
    """.trimIndent()
}

private fun renderError(message: String) {
    document.getElementById("app")?.innerHTML = "<main class='shell'><section class='section'><div class='empty'>연결 오류: ${escape(message)}</div></section></main>"
}

private fun renderApp(data: BootstrapPayload) {
    val root = document.getElementById("app") ?: return
    root.innerHTML = """
    <main class="shell">
      <nav class="nav">
        <div class="brand"><span class="brand-mark">✦</span><span>WordLight</span></div>
        <div class="nav-actions"><button class="ghost" id="savedNav">저장한 말씀</button><button class="primary" id="todayNav">오늘의 말씀</button></div>
      </nav>
      <section class="hero" id="today">
        <div>
          <span class="eyebrow">✦ 하루 한 구절 · 한 생각 · 한 걸음</span>
          <h1>말씀으로 하루를<br/><em>밝히는 공간</em></h1>
          <p>바쁜 하루 속에서도 한 구절을 천천히 읽고, 마음에 남는 단어를 붙들고, 작은 실천으로 이어 보세요.</p>
          <div class="search"><input id="searchInput" placeholder="예: 사랑, 평안, 로마서, 두려움"/><button id="searchBtn">말씀 찾기</button></div>
        </div>
        ${dailyHtml(data.daily)}
      </section>
      <section class="section" id="topics">
        <div class="section-head"><div><h2>오늘 마음에 필요한 말씀</h2><p>주제를 누르면 관련 구절만 모아 보여드려요.</p></div></div>
        <div class="topic-grid">${data.topics.joinToString("") { topicHtml(it) }}</div>
      </section>
      <section class="section" id="verses">
        <div class="section-head"><div><h2 id="verseTitle">추천 말씀</h2><p id="verseSubtitle">천천히 읽고, 마음에 남는 문장을 저장해 보세요.</p></div><button class="ghost" id="resetBtn">전체 보기</button></div>
        <div class="verse-grid" id="verseGrid">${versesHtml(data.featured)}</div>
        <div class="note-panel">
          <div><h3>오늘의 묵상 노트</h3><p>말씀을 읽으며 떠오른 감사, 질문, 결단을 자유롭게 적어 보세요. 이 내용은 브라우저에만 저장됩니다.</p></div>
          <div><textarea id="note" placeholder="오늘 말씀을 통해 마음에 남은 것은…"></textarea><div class="note-actions"><button class="primary" id="saveNote">묵상 저장</button></div></div>
        </div>
      </section>
      <footer class="footer"><span>WordLight · Kotlin/JS + Ktor</span><span>Demo scripture dataset · 실제 서비스에서는 정식 라이선스 성경 데이터 연결 권장</span></footer>
    </main><div id="toast" class="toast"></div>
    """.trimIndent()
    wireInteractions()
}

private fun dailyHtml(d: DailyVerse) = """
<div class="daily-card"><div><div class="daily-label"><span>Today's Word</span><span>✦</span></div><div class="daily-text">“${escape(d.verse.text)}”</div><div class="daily-ref">${escape(d.verse.reference)}</div></div><div class="daily-note">${escape(d.message)}<br/><br/>${escape(d.prayer)}</div></div>
""".trimIndent()

private fun topicHtml(t: Topic) = """
<button class="topic" data-topic="${escape(t.title)}"><div class="topic-icon">${t.emoji}</div><h3>${escape(t.title)}</h3><p>${escape(t.description)}</p><div class="topic-count">관련 말씀 ${t.count}개</div></button>
""".trimIndent()

private fun verseHtml(v: Verse): String {
    val saved = v.id in savedIds
    return """
    <article class="verse"><div class="verse-top"><span class="verse-ref">${escape(v.reference)}</span><button class="heart ${if (saved) "saved" else ""}" data-save="${v.id}" title="저장">${if (saved) "♥" else "♡"}</button></div><div class="verse-text">${escape(v.text)}</div><div class="chips">${v.topics.joinToString("") { "<span class='chip'>${escape(it)}</span>" }}</div><div class="reflect">${escape(v.reflection)}</div></article>
    """.trimIndent()
}

private fun versesHtml(items: List<Verse>) = if (items.isEmpty()) "<div class='empty'>조건에 맞는 말씀이 없습니다. 다른 검색어를 입력해 보세요.</div>" else items.joinToString("") { verseHtml(it) }

private fun wireInteractions() {
    (document.getElementById("searchBtn") as? HTMLButtonElement)?.onclick = { searchFromInput(); null }
    (document.getElementById("searchInput") as? HTMLInputElement)?.onkeydown = { e -> if (e.asDynamic().key == "Enter") searchFromInput(); null }
    (document.getElementById("resetBtn") as? HTMLButtonElement)?.onclick = { loadVerses(); null }
    (document.getElementById("todayNav") as? HTMLButtonElement)?.onclick = { document.getElementById("today")?.scrollIntoView(); null }
    (document.getElementById("savedNav") as? HTMLButtonElement)?.onclick = { showSaved(); null }
    document.querySelectorAll("[data-topic]").asList().forEach { el ->
        (el as? HTMLElement)?.onclick = { loadVerses(topic = el.getAttribute("data-topic")); null }
    }
    wireHearts()
    val note = document.getElementById("note") as? HTMLTextAreaElement
    note?.value = localStorage.getItem("wordlight.note") ?: ""
    (document.getElementById("saveNote") as? HTMLButtonElement)?.onclick = {
        localStorage.setItem("wordlight.note", note?.value ?: "")
        toast("묵상 노트를 저장했습니다.")
        null
    }
}

private fun wireHearts() {
    document.querySelectorAll("[data-save]").asList().forEach { el ->
        (el as? HTMLButtonElement)?.onclick = {
            val id = el.getAttribute("data-save")
            if (id != null) {
                if (!savedIds.add(id)) savedIds.remove(id)
                persistSaved()
                el.textContent = if (id in savedIds) "♥" else "♡"
                el.classList.toggle("saved", id in savedIds)
                toast(if (id in savedIds) "말씀을 저장했습니다." else "저장을 해제했습니다.")
            }
            null
        }
    }
}

private fun searchFromInput() {
    val q = (document.getElementById("searchInput") as? HTMLInputElement)?.value?.trim().orEmpty()
    loadVerses(query = q)
}

private fun loadVerses(query: String? = null, topic: String? = null) {
    scope.launch {
        val url = when {
            !query.isNullOrBlank() -> "/api/verses?q=${encodeURIComponent(query)}"
            !topic.isNullOrBlank() -> "/api/verses?topic=${encodeURIComponent(topic)}"
            else -> "/api/verses"
        }
        runCatching { fetchJson(url, ListSerializer(Verse.serializer())) }
            .onSuccess { items ->
                currentVerses = items
                setVerses(items, when { !query.isNullOrBlank() -> "‘$query’ 검색 결과"; !topic.isNullOrBlank() -> "$topic 말씀"; else -> "전체 말씀" })
            }
            .onFailure { toast("말씀을 불러오지 못했습니다.") }
    }
}

private fun showSaved() {
    val all = bootstrap?.featured.orEmpty() + currentVerses
    val unique = all.distinctBy { it.id }.filter { it.id in savedIds }
    if (unique.size == savedIds.size) setVerses(unique, "저장한 말씀") else {
        scope.launch {
            runCatching { fetchJson("/api/verses?limit=50", ListSerializer(Verse.serializer())) }
                .onSuccess { setVerses(it.filter { v -> v.id in savedIds }, "저장한 말씀") }
        }
    }
}

private fun setVerses(items: List<Verse>, title: String) {
    currentVerses = items
    document.getElementById("verseTitle")?.textContent = title
    document.getElementById("verseGrid")?.innerHTML = versesHtml(items)
    wireHearts()
    document.getElementById("verses")?.scrollIntoView()
}

private suspend fun <T> fetchJson(url: String, serializer: kotlinx.serialization.KSerializer<T>): T {
    val response = window.fetch(url).await() as Response
    if (!response.ok) error("HTTP ${response.status}")
    return json.decodeFromString(serializer, response.text().await())
}

private fun loadSaved() {
    localStorage.getItem("wordlight.saved")?.split(',')?.filter { it.isNotBlank() }?.let(savedIds::addAll)
}
private fun persistSaved() = localStorage.setItem("wordlight.saved", savedIds.joinToString(","))
private external fun encodeURIComponent(value: String): String
private fun escape(value: String): String = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
private fun toast(message: String) {
    val el = document.getElementById("toast") ?: return
    el.textContent = message; el.classList.add("show")
    window.setTimeout({ el.classList.remove("show") }, 1800)
}
private fun NodeList.asList(): List<Node> = (0 until length).mapNotNull { item(it) }
