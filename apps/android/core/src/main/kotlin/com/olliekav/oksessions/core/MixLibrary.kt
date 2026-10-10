package com.olliekav.oksessions.core

/** Matches "#12" or "12" to the session number, otherwise title and genre; in session order. */
fun search(mixes: List<Mix>, query: String): List<Mix> {
    val inOrder = mixes.sortedBy { it.number }
    val trimmed = query.trim()
    if (trimmed.isEmpty()) return inOrder
    val digits = trimmed.removePrefix("#")
    digits.toIntOrNull()?.let { number ->
        return inOrder.filter { it.number.toString().startsWith(number.toString()) }
    }
    return inOrder.filter {
        it.title.contains(trimmed, ignoreCase = true) || it.genre?.contains(trimmed, ignoreCase = true) == true
    }
}
