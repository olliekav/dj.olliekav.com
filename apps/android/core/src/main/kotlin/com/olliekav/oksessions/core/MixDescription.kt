package com.olliekav.oksessions.core

/**
 * A mix description split into its intro and tracklist, which the descriptions write as a
 * "Tracklist" heading (often underlined with ===) followed by one track per line, or as a
 * bare closing block of "Artist - Title" lines.
 */
data class MixDescription(val intro: String, val tracks: List<String>) {
    companion object {
        fun parse(text: String): MixDescription {
            val lines = text.lines()
            val heading = lines.indexOfFirst(::isTracklistHeading)
            if (heading < 0) return withoutHeading(lines)
            val intro = lines.subList(0, heading).joinToString("\n").trim()
            val tracks = lines.drop(heading + 1)
                .map { stripNumbering(it.trim()) }
                .filter { it.isNotEmpty() && !isRule(it) }
            return MixDescription(intro, tracks)
        }

        /**
         * Without a heading, the closing paragraphs are the tracklist if they're mostly
         * "Artist - Title" lines (at least three in all). A one-line paragraph before them stays
         * in the intro, since a sentence can have a dash in it too.
         */
        private fun withoutHeading(lines: List<String>): MixDescription {
            val trimmed = lines.map { it.trim() }
            val paragraphs = mutableListOf<IntRange>()
            var index = 0
            while (index < trimmed.size) {
                if (trimmed[index].isEmpty()) { index++; continue }
                val start = index
                while (index < trimmed.size && trimmed[index].isNotEmpty()) index++
                paragraphs += start until index
            }
            var start = trimmed.size
            for (position in paragraphs.indices.reversed()) {
                val block = trimmed.slice(paragraphs[position])
                val isLast = position == paragraphs.lastIndex
                if (block.count(::looksLikeTrack) * 5 < block.size * 4 || (block.size <= 1 && !isLast)) break
                start = paragraphs[position].first
            }
            val tracks = trimmed.drop(start).filter { it.isNotEmpty() }.map(::stripNumbering)
            if (tracks.size < 3) return MixDescription(lines.joinToString("\n").trim(), emptyList())
            return MixDescription(lines.subList(0, start).joinToString("\n").trim(), tracks)
        }

        private fun looksLikeTrack(line: String) = " - " in line || " – " in line || " — " in line

        private fun isTracklistHeading(line: String): Boolean {
            val trimmed = line.trim().trim(':')
            return trimmed.equals("tracklist", ignoreCase = true) || trimmed.equals("track list", ignoreCase = true)
        }

        /** Lines of =, - or _ used as underlines and dividers */
        private fun isRule(line: String) = line.length >= 3 && line.all { it in "=-_—" }

        /** "1. Artist - Title" or "01) Artist - Title" → "Artist - Title"; the list numbers itself */
        private fun stripNumbering(line: String) = line.replaceFirst(Regex("""^\d{1,3}[.)]\s+"""), "")
    }
}
