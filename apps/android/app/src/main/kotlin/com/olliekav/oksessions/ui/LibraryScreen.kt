package com.olliekav.oksessions.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.olliekav.oksessions.MixLibrary
import com.olliekav.oksessions.core.Mix
import com.olliekav.oksessions.core.search
import com.olliekav.oksessions.playback.PlayerConnection
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    library: MixLibrary,
    player: PlayerConnection,
    mixes: List<Mix>,
    state: MixLibrary.State,
    onOpen: (Mix) -> Unit,
    onShuffleAll: () -> Unit,
    bottomPadding: PaddingValues,
) {
    val scope = rememberCoroutineScope()
    var query by rememberSaveable { mutableStateOf("") }
    var isSearching by rememberSaveable { mutableStateOf(false) }
    var isRefreshing by remember { mutableStateOf(false) }
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            if (isSearching) {
                SearchBar(query, onQuery = { query = it }, onClose = { isSearching = false; query = "" })
            } else {
                LargeTopAppBar(
                    title = { Text("O:K Sessions", fontWeight = FontWeight.Bold) },
                    actions = {
                        IconButton(onClick = onShuffleAll, enabled = mixes.isNotEmpty(), modifier = Modifier.testTag("shuffle-all")) {
                            Icon(Icons.Rounded.Shuffle, "Shuffle all")
                        }
                        IconButton(onClick = { isSearching = true }, modifier = Modifier.testTag("search-button")) {
                            Icon(Icons.Rounded.Search, "Search")
                        }
                    },
                    scrollBehavior = scrollBehavior,
                )
            }
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                scope.launch {
                    isRefreshing = true
                    library.refresh()
                    isRefreshing = false
                }
            },
            modifier = Modifier.fillMaxSize().padding(top = padding.calculateTopPadding()),
        ) {
            when {
                mixes.isEmpty() && state is MixLibrary.State.Failed -> Message(state.message) {
                    Button(onClick = { scope.launch { library.refresh() } }) { Text("Try again") }
                }
                mixes.isEmpty() -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
                else -> {
                    val shown = search(mixes, query)
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 185.dp),
                        contentPadding = bottomPadding,
                        modifier = Modifier.fillMaxSize().testTag("mix-grid"),
                    ) {
                        items(shown, key = { it.id }) { mix ->
                            MixTile(
                                mix,
                                isCurrent = player.current?.number == mix.number,
                                isPlaying = player.isPlaying,
                                modifier = Modifier.clickable(onClickLabel = "Play ${mix.title}") { onOpen(mix) }
                                    .testTag("mix-${mix.number}"),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MixTile(mix: Mix, isCurrent: Boolean, isPlaying: Boolean, modifier: Modifier = Modifier) {
    Box(modifier) {
        MixArtwork(mix, Modifier.fillMaxWidth())
        if (isCurrent) {
            PlayingBars(isPlaying, hexColor(mix.theme.foreground), Modifier.align(Alignment.TopEnd).padding(10.dp))
        }
    }
}

@Composable
private fun SearchBar(query: String, onQuery: (String) -> Unit, onClose: () -> Unit) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    Row(
        Modifier.fillMaxWidth().windowInsetsPadding(TopAppBarDefaults.windowInsets).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        TextField(
            value = query,
            onValueChange = onQuery,
            placeholder = { Text("Number, title or genre") },
            leadingIcon = { Icon(Icons.Rounded.Search, null) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            shape = CircleShape,
            colors = TextFieldDefaults.colors(focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent),
            modifier = Modifier.weight(1f).focusRequester(focus).testTag("search-field"),
        )
        IconButton(onClick = onClose, modifier = Modifier.testTag("close-search")) { Icon(Icons.Rounded.Close, "Close search") }
    }
}

@Composable
private fun Message(text: String, action: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text, style = MaterialTheme.typography.bodyLarge)
        action()
    }
}
