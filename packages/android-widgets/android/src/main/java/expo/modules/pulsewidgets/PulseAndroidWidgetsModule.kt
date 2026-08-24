package expo.modules.pulsewidgets

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.color.ColorProvider as DynamicColorProvider
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import org.json.JSONArray

private const val STORE = "pulse_widget_snapshots_v1"
private const val PENDING_COMPLETIONS = "pending_completions"
private val taskIdKey = ActionParameters.Key<String>("taskId")
private val viewKey = ActionParameters.Key<String>("view")

private data class WidgetTask(val id: String, val title: String, val due: String?, val project: String?, val location: String?, val labels: List<String>, val date: String?, val overdue: Boolean, val priority: String, val showHeader: Boolean = false)
private data class WidgetData(val title: String, val count: Int, val accent: Int, val theme: String, val opacity: Float, val density: String, val detailed: Boolean, val grouped: Boolean, val tasks: List<WidgetTask>)

private fun emptyData(view: String) = WidgetData(view.replaceFirstChar { it.uppercase() }, 0, 0xFFDC4C3E.toInt(), "system", 1f, "comfortable", false, false, emptyList())

private fun readData(context: Context, view: String): WidgetData {
  val raw = context.getSharedPreferences(STORE, Context.MODE_PRIVATE).getString(view, null)
    ?: return emptyData(view)
  return try {
    val json = JSONObject(raw)
    val config = json.optJSONObject("configuration")
    val grouped = config?.optString("arrangement") == "grouped" && (json.optString("view") == "inbox" || json.optString("view") == "upcoming")
    val tasksJson = json.optJSONArray("tasks")
    val parsed = buildList {
      if (tasksJson != null) for (index in 0 until tasksJson.length()) {
        val task = tasksJson.getJSONObject(index)
        val labels = task.optJSONArray("tagNames")?.let { array -> List(array.length()) { array.optString(it) }.filter(String::isNotBlank) } ?: emptyList()
        fun optional(name: String) = task.optString(name).takeIf { it.isNotBlank() && it != "null" }
        add(WidgetTask(task.getString("id"), task.getString("title"), optional("dueLabel"), optional("projectName"), optional("location"), labels, optional("dateLabel"), task.optBoolean("isOverdue"), task.optString("priority", "none")))
      }
    }
    val tasks = parsed.mapIndexed { index, task -> task.copy(showHeader = grouped && task.date != parsed.getOrNull(index - 1)?.date) }
    WidgetData(json.optString("title", view), json.optInt("openCount", tasks.size), android.graphics.Color.parseColor(json.optString("accentColor", "#dc4c3e")), config?.optString("theme", "system") ?: "system", (config?.optDouble("backgroundOpacity", 1.0) ?: 1.0).toFloat(), config?.optString("density", "comfortable") ?: "comfortable", config?.optString("density") == "detailed", grouped, tasks)
  } catch (_: Exception) { emptyData(view) }
}

private fun colors(data: WidgetData): Triple<ColorProvider, ColorProvider, ColorProvider> {
  val alpha = (data.opacity.coerceIn(0f, 1f) * 255).toInt()
  val lightBackground = Color((alpha shl 24) or 0xFFFFFF)
  val darkBackground = Color((alpha shl 24) or 0x202022)
  return when (data.theme) {
    "dark" -> Triple(DynamicColorProvider(darkBackground, darkBackground), DynamicColorProvider(Color(0xFFF5F5F6), Color(0xFFF5F5F6)), DynamicColorProvider(Color(0xFFA1A1A7), Color(0xFFA1A1A7)))
    "light" -> Triple(DynamicColorProvider(lightBackground, lightBackground), DynamicColorProvider(Color(0xFF202124), Color(0xFF202124)), DynamicColorProvider(Color(0xFF77787D), Color(0xFF77787D)))
    else -> Triple(DynamicColorProvider(lightBackground, darkBackground), DynamicColorProvider(Color(0xFF202124), Color(0xFFF5F5F6)), DynamicColorProvider(Color(0xFF77787D), Color(0xFFA1A1A7)))
  }
}

private fun priorityColor(priority: String): androidx.glance.unit.ColorProvider {
  val color = Color(when (priority) {
  "urgent" -> 0xFFDC4F49.toInt(); "high" -> 0xFFE2783E.toInt(); "medium" -> 0xFFD7A528.toInt(); "low" -> 0xFF4A8FE7.toInt(); else -> 0xFF96969D.toInt()
  })
  return DynamicColorProvider(day = color, night = color)
}

abstract class PulseTaskWidget(private val view: String) : GlanceAppWidget() {
  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val data = readData(context, view)
    provideContent { WidgetContent(data, view, context.packageName) }
  }
}

class TodayTaskWidget : PulseTaskWidget("today")
class InboxTaskWidget : PulseTaskWidget("inbox")
class UpcomingTaskWidget : PulseTaskWidget("upcoming")
class OverdueTaskWidget : PulseTaskWidget("overdue")
class TasksTaskWidget : PulseTaskWidget("tasks")

private fun widgetForView(view: String): PulseTaskWidget = when (view) {
  "inbox" -> InboxTaskWidget()
  "upcoming" -> UpcomingTaskWidget()
  "overdue" -> OverdueTaskWidget()
  "tasks" -> TasksTaskWidget()
  else -> TodayTaskWidget()
}

@Composable
private fun WidgetContent(data: WidgetData, view: String, packageName: String) {
  val (background, foreground, muted) = colors(data)
  val compact = data.density == "compact"
  val addIntent = Intent(Intent.ACTION_VIEW, Uri.parse("pulse://widget/add")).setClassName(packageName, "$packageName.MainActivity")
  val viewIntent = Intent(Intent.ACTION_VIEW, Uri.parse("pulse://widget/view/$view")).setClassName(packageName, "$packageName.MainActivity")
  Column(modifier = GlanceModifier.fillMaxSize().appWidgetBackground().background(background).cornerRadius(22.dp).padding(if (compact) 12.dp else 16.dp)) {
    Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Vertical.CenterVertically) {
      Row(modifier = GlanceModifier.defaultWeight().clickable(actionStartActivity(viewIntent)), verticalAlignment = Alignment.Vertical.CenterVertically) {
        Text(data.title, style = TextStyle(color = foreground, fontWeight = FontWeight.Bold, fontSize = 17.sp))
        Spacer(GlanceModifier.defaultWeight())
        Text(data.count.toString(), style = TextStyle(color = DynamicColorProvider(day = Color(data.accent), night = Color(data.accent)), fontWeight = FontWeight.Bold, fontSize = 12.sp))
      }
      Spacer(GlanceModifier.width(10.dp))
      Text("+", style = TextStyle(color = foreground, fontWeight = FontWeight.Bold, fontSize = 21.sp), modifier = GlanceModifier.clickable(actionStartActivity(addIntent)).padding(horizontal = 4.dp))
    }
    Spacer(GlanceModifier.height(10.dp))
    if (data.tasks.isEmpty()) {
      Text("All clear", style = TextStyle(color = foreground, fontWeight = FontWeight.Medium))
      Spacer(GlanceModifier.height(4.dp))
      Text("Open Pulse to plan what is next.", style = TextStyle(color = muted))
    } else {
      LazyColumn(modifier = GlanceModifier.fillMaxSize()) {
        items(data.tasks, itemId = { it.id.hashCode().toLong() }) { task -> TaskItem(task, view, packageName, data, foreground, muted) }
      }
    }
  }
}

@Composable
private fun TaskItem(task: WidgetTask, view: String, packageName: String, data: WidgetData, foreground: ColorProvider, muted: ColorProvider) {
  val intent = Intent(Intent.ACTION_VIEW, Uri.parse("pulse://widget/task/${task.id}?view=$view")).setClassName(packageName, "$packageName.MainActivity")
  Column(modifier = GlanceModifier.fillMaxWidth()) {
    if (task.showHeader) {
      Row(modifier = GlanceModifier.fillMaxWidth().padding(top = 7.dp, bottom = 3.dp), verticalAlignment = Alignment.Vertical.CenterVertically) {
        Text(task.date ?: "No date", maxLines = 1, style = TextStyle(color = if (task.overdue) DynamicColorProvider(Color(0xFFDC4F49), Color(0xFFDC4F49)) else muted, fontWeight = FontWeight.Bold, fontSize = 11.sp))
        Spacer(GlanceModifier.width(8.dp))
        Box(modifier = GlanceModifier.defaultWeight().height(1.dp).background(DynamicColorProvider(Color(0x1A77787D), Color(0x3377787D)))) {}
      }
    }
    Row(modifier = GlanceModifier.fillMaxWidth().clickable(actionStartActivity(intent)).padding(vertical = if (data.density == "compact") 4.dp else 7.dp), verticalAlignment = Alignment.Vertical.CenterVertically) {
      Box(modifier = GlanceModifier.size(20.dp).cornerRadius(10.dp).background(DynamicColorProvider(Color(0x00000000), Color(0x00000000))).clickable(actionRunCallback<CompleteTaskAction>(actionParametersOf(taskIdKey to task.id, viewKey to view))), contentAlignment = Alignment.Center) {
        Text("○", style = TextStyle(color = priorityColor(task.priority), fontWeight = FontWeight.Bold, fontSize = 18.sp))
      }
      Spacer(GlanceModifier.width(9.dp))
      Column(modifier = GlanceModifier.defaultWeight()) {
        Text(task.title, maxLines = if (data.detailed) 2 else 1, style = TextStyle(color = foreground, fontWeight = FontWeight.Medium, fontSize = if (data.density == "compact") 12.sp else 14.sp))
        val meta = listOfNotNull(if (data.grouped) null else task.due, task.project, if (data.detailed) task.location else null, if (data.detailed && task.labels.isNotEmpty()) task.labels.joinToString(", ") else null).joinToString(" · ")
        if (meta.isNotEmpty()) Text(meta, maxLines = 1, style = TextStyle(color = if (task.overdue) DynamicColorProvider(day = Color(0xFFDC4F49), night = Color(0xFFDC4F49)) else muted, fontSize = 10.sp))
      }
    }
  }
}

class CompleteTaskAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
    val taskId = parameters[taskIdKey] ?: return
    val view = parameters[viewKey] ?: "today"
    val preferences = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
    val pending = preferences.getStringSet(PENDING_COMPLETIONS, emptySet())?.toMutableSet() ?: mutableSetOf()
    pending.add(taskId)
    val editor = preferences.edit().putStringSet(PENDING_COMPLETIONS, pending)
    listOf("today", "inbox", "upcoming", "overdue", "tasks").forEach { slot ->
      val raw = preferences.getString(slot, null) ?: return@forEach
      try {
        val json = JSONObject(raw)
        val tasks = json.optJSONArray("tasks") ?: JSONArray()
        val next = JSONArray()
        var removed = false
        for (index in 0 until tasks.length()) {
          val task = tasks.getJSONObject(index)
          if (task.optString("id") == taskId) removed = true else next.put(task)
        }
        if (removed) {
          json.put("tasks", next)
          json.put("openCount", maxOf(0, json.optInt("openCount") - 1))
          json.put("totalCount", maxOf(0, json.optInt("totalCount") - 1))
          editor.putString(slot, json.toString())
        }
      } catch (_: Exception) { /* Keep the last valid snapshot if one slot is malformed. */ }
    }
    editor.commit()
    // Redraw the tapped instance immediately, then every widget type so a task
    // shared by multiple views disappears everywhere without waiting for JS.
    widgetForView(view).update(context, glanceId)
    reloadAllWidgets(context)
  }
}

class TodayWidgetReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = TodayTaskWidget() }
class InboxWidgetReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = InboxTaskWidget() }
class UpcomingWidgetReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = UpcomingTaskWidget() }
class OverdueWidgetReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = OverdueTaskWidget() }
class TasksWidgetReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = TasksTaskWidget() }

class PulseAndroidWidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PulseAndroidWidgets")
    AsyncFunction("updateSnapshot") Coroutine { view: String, snapshot: String ->
      val context = appContext.reactContext
      if (context != null) {
        context.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit().putString(view, snapshot).commit()
        reload(context, view)
      }
    }
    AsyncFunction("reloadAll").Coroutine<Unit> {
      val context = appContext.reactContext
      if (context != null) reloadAllWidgets(context)
    }
    AsyncFunction("consumeCompletedTaskIds") {
      val context = appContext.reactContext
      if (context == null) emptyList<String>() else {
        val preferences = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
        val ids = preferences.getStringSet(PENDING_COMPLETIONS, emptySet())?.toList() ?: emptyList()
        preferences.edit().remove(PENDING_COMPLETIONS).apply()
        ids
      }
    }
  }
}

private suspend fun reload(context: Context, view: String) {
  // Each slot has a distinct Glance class. Glance keys installed instances by
  // class, so sharing one class caused Inbox/Today instances to overwrite one
  // another during updateAll.
  try { widgetForView(view).updateAll(context) } catch (_: Exception) { /* A removed widget can disappear between refresh and update. */ }
}

private suspend fun reloadAllWidgets(context: Context) {
  listOf("today", "inbox", "upcoming", "overdue", "tasks").forEach { reload(context, it) }
}
