
"use strict";

// =============================================
// OPPORTUNITY TRACKER
// Browser storage version
// =============================================

const STORAGE_KEY = "opportunityTrackerApplicationsV1";

const TYPES = [
  "Scholarship", "Job", "Internship", "Grant",
  "Fellowship", "Volunteering", "Others"
];

const STATUSES = [
  "Not applied", "In progress", "Applied",
  "Interview", "Offer received", "Rejected"
];

const FUNDING = [
  "Unknown", "Fully funded", "Partially funded",
  "Self-funded", "Not applicable"
];

const $ = id => document.getElementById(id);

const form = $("applicationForm");
const applicationList = $("applicationList");
const emptyMessage = $("emptyMessage");

let applications = [];
let editingId = null;
let toastTimer = null;

// ---------- Utilities ----------

function createId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  })[c]);
}

function getValue(id) {
  return $(id)?.value.trim() || "";
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function validDate(value) {
  if (value === "" || value === null || value === undefined) return true;
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function daysUntil(value) {
  if (!value || !validDate(value)) return null;

  return Math.round(
    (Date.parse(value + "T00:00:00Z") -
     Date.parse(todayString() + "T00:00:00Z")) / 86400000
  );
}

function formatDate(value) {
  if (!value) return "No deadline";
  if (!validDate(value)) return "Invalid date";

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(
    undefined,
    { day: "numeric", month: "short", year: "numeric" }
  );
}

function safeUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function showToast(message, error = false) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

// ---------- Records and browser storage ----------

function normalizeRecord(record) {
  if (!record || typeof record !== "object" ||
      typeof record.name !== "string" || !record.name.trim()) {
    return null;
  }

  return {
    id: typeof record.id === "string" && record.id
      ? record.id : createId(),
    type: TYPES.includes(record.type) ? record.type : "Others",
    name: record.name.trim(),
    organization: safeText(record.organization),
    location: safeText(record.location),
    deadline: validDate(record.deadline) ? record.deadline || "" : "",
    status: STATUSES.includes(record.status) ? record.status : "Not applied",
    funding: FUNDING.includes(record.funding) ? record.funding : "Unknown",
    url: safeUrl(record.url),
    description: safeText(record.description),
    documents: safeText(record.documents),
    notes: safeText(record.notes),
    rejectionReason: safeText(record.rejectionReason),
    updatedAt: safeText(record.updatedAt)
  };
}

function loadApplications() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(normalizeRecord).filter(Boolean);
  } catch (error) {
    console.error("Could not load applications:", error);
    showToast("Saved records could not be loaded. Do not clear browser data.", true);
    return [];
  }
}

function saveApplications() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    return true;
  } catch (error) {
    console.error("Could not save applications:", error);
    showToast("Unable to save changes. Export a backup if possible.", true);
    return false;
  }
}

// ---------- Deadline calculations ----------

// This is the single source of truth for all deadline counters.
function getDeadlineCounts() {
  const active = applications.filter(item =>
    !["Offer received", "Rejected"].includes(item.status)
  );

  const upcoming = active.filter(item => {
    const days = daysUntil(item.deadline);
    return days !== null && days >= 0 && days <= 7;
  });

  const overdue = active.filter(item => {
    const days = daysUntil(item.deadline);
    return days !== null && days < 0;
  });

  return { upcoming, overdue };
}

function deadlineInfo(item) {
  const days = daysUntil(item.deadline);

  if (days === null) return { text: "No deadline", tone: "" };
  if (days < 0) return { text: `${Math.abs(days)} day(s) overdue`, tone: "overdue" };
  if (days === 0) return { text: "Due today", tone: "overdue" };
  if (days <= 3) return { text: `${days} day(s) left`, tone: "overdue" };
  if (days <= 7) return { text: `${days} days left`, tone: "deadline" };

  return { text: `${days} days left`, tone: "" };
}

function makeDeadlineItem(item) {
  const info = deadlineInfo(item);
  const row = document.createElement("article");
  row.className = "deadline-item";

  if (info.tone === "overdue") row.classList.add("overdue");
  if (info.tone === "deadline") row.classList.add("due-soon");

  const marker = document.createElement("span");
  marker.className = "deadline-marker";

  const content = document.createElement("div");
  content.className = "deadline-content";

  const title = document.createElement("strong");
  title.textContent = item.name;

  const detail = document.createElement("p");
  detail.textContent = `${item.type} · ${formatDate(item.deadline)}`;

  content.append(title, detail);

  const badge = document.createElement("span");
  badge.className = "deadline-label";
  badge.textContent = info.text;

  row.append(marker, content, badge);
  return row;
}

function renderDeadlines() {
  const { upcoming, overdue } = getDeadlineCounts();

  // All these numbers use exactly the same upcoming count.
  document.querySelectorAll("[data-deadline-count]").forEach(element => {
    element.textContent = upcoming.length;
  });

  $("navDeadlineCount").textContent = upcoming.length + overdue.length;
  $("overdueCount").textContent = overdue.length;

  const notice = $("deadlineNotice");
  notice.className = "notice";

  if (overdue.length) {
    notice.classList.add("overdue");
    notice.textContent =
      `${overdue.length} overdue deadline(s) need attention. ` +
      `${upcoming.length} active deadline(s) are due within 7 days.`;
  } else if (upcoming.length) {
    notice.classList.add("deadline");
    notice.textContent =
      `${upcoming.length} active deadline(s) are due within the next 7 days.`;
  } else {
    notice.textContent = "You're all caught up! No active deadlines within the next 7 days.";
  }

  const all = [...overdue, ...upcoming]
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const preview = $("deadlinePreview");
  const list = $("deadlineList");

  preview.replaceChildren();
  list.replaceChildren();

  if (!all.length) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "No upcoming or overdue deadlines.";
    preview.append(message);
    list.append(message.cloneNode(true));
    return;
  }

  all.slice(0, 4).forEach(item => preview.append(makeDeadlineItem(item)));
  all.forEach(item => list.append(makeDeadlineItem(item)));
}

// ---------- Application cards ----------

function makeAction(label, action, id) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.dataset.id = id;
  button.textContent = label;
  return button;
}

function makeCard(item) {
  const card = document.createElement("article");
  card.className = "application-card";

  const info = deadlineInfo(item);
  const statusClass = {
    "Applied": "applied",
    "Offer received": "offer",
    "In progress": "progress",
    "Interview": "interview",
    "Rejected": "rejected"
  }[item.status] || "";

  const title = document.createElement("h3");
  title.textContent = item.name;

  const subtitle = document.createElement("p");
  subtitle.textContent = [
    item.type, item.organization, item.location
  ].filter(Boolean).join(" · ");

  const badges = document.createElement("div");
  badges.className = "record-details";

  [
    [item.status, statusClass],
    [item.funding, ""],
    [item.deadline ? `${formatDate(item.deadline)} · ${info.text}` : "No deadline", info.tone]
  ].forEach(([text, className]) => {
    const badge = document.createElement("span");
    badge.className = `pill ${className}`;
    badge.textContent = text;
    badges.append(badge);
  });

  card.append(title, subtitle, badges);

  if (item.description) {
    const description = document.createElement("p");
    description.className = "description-preview";
    description.textContent = item.description;
    card.append(description);
  }

  if (item.documents) {
    const documents = document.createElement("p");
    documents.textContent = `Documents: ${item.documents}`;
    card.append(documents);
  }

  if (item.notes) {
    const notes = document.createElement("p");
    notes.textContent = `Notes: ${item.notes}`;
    card.append(notes);
  }

  if (item.status === "Rejected") {
    const reason = document.createElement("p");
    reason.className = "reason";
    reason.textContent = `Rejection feedback: ${
      item.rejectionReason || "No reason recorded yet."
    }`;
    card.append(reason);
  }

  if (item.url) {
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open official website ↗";
    card.append(link);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  actions.append(
    makeAction("Edit", "edit", item.id),
    makeAction(
      item.status === "Applied" ? "Mark not applied" : "Mark applied",
      "toggle", item.id
    ),
    makeAction("Export", "export-one", item.id),
    makeAction("Delete", "delete", item.id)
  );

  card.append(actions);
  return card;
}

function renderApplications() {
  const query = $("search").value.trim().toLowerCase();
  const type = $("typeFilter").value;
  const status = $("statusFilter").value;
  const funding = $("fundingFilter").value;

  const filtered = applications.filter(item => {
    const searchable = [
      item.name, item.type, item.organization, item.location,
      item.funding, item.description, item.documents, item.notes,
      item.rejectionReason
    ].join(" ").toLowerCase();

    return (!query || searchable.includes(query)) &&
      (!type || item.type === type) &&
      (!status || item.status === status) &&
      (!funding || item.funding === funding);
  }).sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });

  applicationList.replaceChildren();

  $("resultCount").textContent =
    `${filtered.length} ${filtered.length === 1 ? "opportunity" : "opportunities"}`;

  emptyMessage.hidden = filtered.length > 0;
  emptyMessage.textContent = applications.length
    ? "No opportunities match your search or filters."
    : "No opportunities yet. Add your first one!";

  filtered.forEach(item => applicationList.append(makeCard(item)));

  renderRecentApplications();
  renderRejections();
  updateDashboard();
}

// ---------- Recent applications ----------

function renderRecentApplications() {
  const container = $("recentApplications");
  container.replaceChildren();

  const recent = [...applications].reverse().slice(0, 4);

  if (!recent.length) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "Your latest opportunities will appear here.";
    container.append(message);
    return;
  }

  recent.forEach(item => container.append(makeCard(item)));
}

// ---------- Rejection review ----------

function renderRejections() {
  const rejected = applications.filter(item => item.status === "Rejected");

  $("rejectionCount").textContent = rejected.length;
  $("rejectionPageCount").textContent =
    `${rejected.length} rejected`;

  const home = $("homeRejectionList");
  const page = $("rejectionList");

  home.replaceChildren();
  page.replaceChildren();

  $("emptyRejections").hidden = rejected.length > 0;

  if (!rejected.length) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "No rejected applications yet. If an application is rejected, change its status to Rejected to review it here.";
    home.append(message);
    return;
  }

  rejected.forEach(item => {
    const card = document.createElement("article");
    card.className = "rejection-card";

    const title = document.createElement("h3");
    title.textContent = item.name;

    const subtitle = document.createElement("p");
    subtitle.className = "muted";
    subtitle.textContent = [item.type, item.organization]
      .filter(Boolean).join(" · ");

    const reason = document.createElement("p");
    reason.className = "reason";
    reason.textContent = `Reason / feedback: ${
      item.rejectionReason || "Not recorded yet. Edit this application to add details."
    }`;

    card.append(title, subtitle, reason);

    if (item.description) {
      const description = document.createElement("p");
      description.className = "lesson";
      description.textContent = `Opportunity: ${item.description}`;
      card.append(description);
    }

    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(makeAction("Edit rejection notes", "edit", item.id));
    card.append(actions);

    page.append(card);
  });

  rejected.slice(0, 3).forEach(item => {
    const summary = document.createElement("article");
    summary.className = "rejection-card";

    const title = document.createElement("h3");
    title.textContent = item.name;

    const reason = document.createElement("p");
    reason.className = "reason";
    reason.textContent = item.rejectionReason ||
      "No feedback recorded yet. Edit to add your notes.";

    const edit = makeAction("Add / edit reason", "edit", item.id);

    summary.append(title, reason, edit);
    home.append(summary);
  });
}

// ---------- Dashboard counters ----------

function updateDashboard() {
  $("totalCount").textContent = applications.length;
  $("pendingCount").textContent =
    applications.filter(item => item.status === "Not applied").length;
  $("appliedCount").textContent =
    applications.filter(item => item.status === "Applied").length;

  renderDeadlines();
}

// ---------- Form ----------

function updateRejectionField() {
  const rejected = $("status").value === "Rejected";
  $("rejectionReasonGroup").hidden = !rejected;
}

function clearForm() {
  form.reset();
  editingId = null;
  $("formHeading").textContent = "Add an opportunity";
  $("submitButton").textContent = "＋ Save opportunity";
  $("cancelEdit").hidden = true;
  updateRejectionField();
}

function fillForm(item) {
  const fields = [
    "type", "name", "organization", "location", "deadline",
    "status", "funding", "url", "description", "documents",
    "notes", "rejectionReason"
  ];

  fields.forEach(field => {
    const element = $(field);
    if (element) element.value = item[field] || "";
  });

  editingId = item.id;
  $("formHeading").textContent = "Edit opportunity";
  $("submitButton").textContent = "Save changes";
  $("cancelEdit").hidden = false;

  updateRejectionField();

  location.hash = "addOpportunity";
  $("name").focus();
}

$("status").addEventListener("change", updateRejectionField);

$("cancelEdit").addEventListener("click", clearForm);

form.addEventListener("reset", () => {
  setTimeout(() => {
    if (!editingId) updateRejectionField();
  }, 0);
});

form.addEventListener("submit", event => {
  event.preventDefault();

  const name = getValue("name");
  const type = getValue("type");
  const status = getValue("status");
  const funding = getValue("funding");
  const deadline = $("deadline").value;
  const url = getValue("url");

  if (!name) {
    showToast("Please enter an opportunity name.", true);
    return;
  }

  if (!TYPES.includes(type) || !STATUSES.includes(status) ||
      !FUNDING.includes(funding)) {
    showToast("Please select valid opportunity options.", true);
    return;
  }

  if (deadline !== "" && !validDate(deadline)) {
    showToast("Please select a valid deadline from the calendar.", true);
    return;
  }

  if (url && !safeUrl(url)) {
    showToast("Enter a valid website link beginning with http:// or https://.", true);
    return;
  }

  const record = {
    id: editingId || createId(),
    type,
    name,
    organization: getValue("organization"),
    location: getValue("location"),
    deadline,
    status,
    funding,
    url: safeUrl(url),
    description: getValue("description"),
    documents: getValue("documents"),
    notes: getValue("notes"),
    rejectionReason: getValue("rejectionReason"),
    updatedAt: new Date().toISOString()
  };

  const previous = applications;

  applications = editingId
    ? applications.map(item => item.id === editingId ? record : item)
    : [...applications, record];

  if (!saveApplications()) {
    applications = previous;
    return;
  }

  clearForm();
  renderApplications();
  showToast("Opportunity saved successfully.");
});

// ---------- Actions ----------

function handleAction(action, id) {
  const item = applications.find(record => record.id === id);
  if (!item) return;

  if (action === "edit") {
    fillForm(item);
    return;
  }

  if (action === "toggle") {
    const previous = applications;

    applications = applications.map(record =>
      record.id === id
        ? {
            ...record,
            status: record.status === "Applied" ? "Not applied" : "Applied",
            updatedAt: new Date().toISOString()
          }
        : record
    );

    if (!saveApplications()) {
      applications = previous;
      return;
    }

    renderApplications();
    showToast("Application status updated.");
    return;
  }

  if (action === "delete") {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;

    const previous = applications;
    applications = applications.filter(record => record.id !== id);

    if (!saveApplications()) {
      applications = previous;
      return;
    }

    if (editingId === id) clearForm();

    renderApplications();
    showToast("Opportunity deleted.");
    return;
  }

  if (action === "export-one") {
    downloadCSV([item], "opportunity-record.csv");
  }
}

document.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (button) handleAction(button.dataset.action, button.dataset.id);
});

// ---------- CSV export ----------

function downloadCSV(records, filename) {
  if (!records.length) {
    showToast("There are no records to export.", true);
    return;
  }

  const columns = [
    "type", "name", "organization", "location", "deadline",
    "status", "funding", "url", "description", "documents",
    "notes", "rejectionReason", "updatedAt"
  ];

  function csvCell(value) {
    let text = String(value ?? "");

    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;

    return '"' + text.replace(/"/g, '""') + '"';
  }

  const rows = [
    columns.map(csvCell).join(","),
    ...records.map(record =>
      columns.map(column => csvCell(record[column])).join(",")
    )
  ];

  const blob = new Blob(
    ["\uFEFF" + rows.join("\r\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("exportAll").addEventListener("click", () => {
  downloadCSV(applications, "my-opportunities.csv");
});

// ---------- Navigation ----------

function updateNavigation() {
  const sections = [
    "dashboard", "opportunities", "deadlines",
    "rejections", "addOpportunity"
  ];

  const requested = (location.hash || "#dashboard").slice(1);
  const active = sections.includes(requested) ? requested : "dashboard";

  sections.forEach(id => {
    $(id).hidden = id !== active;
  });

  const headings = {
    dashboard: "Home workspace",
    opportunities: "All opportunities",
    deadlines: "Deadline centre",
    rejections: "Rejection review",
    addOpportunity: editingId ? "Edit opportunity" : "Add opportunity"
  };

  $("pageHeading").textContent = headings[active];

  document.querySelectorAll(".nav-link").forEach(link => {
    const selected = link.getAttribute("href") === "#" + active;
    link.classList.toggle("active", selected);

    if (selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  $("sidebar").classList.remove("open");
  $("menuToggle").setAttribute("aria-expanded", "false");
}

$("menuToggle").addEventListener("click", () => {
  const open = $("sidebar").classList.toggle("open");
  $("menuToggle").setAttribute("aria-expanded", String(open));
});

window.addEventListener("hashchange", updateNavigation);

document.querySelectorAll(".navigation a, .welcome-banner a, .panel-heading a")
  .forEach(link => {
    link.addEventListener("click", () => {
      $("sidebar").classList.remove("open");
    });
  });

[$("search"), $("typeFilter"), $("statusFilter"), $("fundingFilter")]
  .forEach(element => {
    element.addEventListener("input", renderApplications);
    element.addEventListener("change", renderApplications);
  });

// ---------- Start ----------

applications = loadApplications();

$("todayLabel").textContent = new Date().toLocaleDateString(
  undefined,
  { weekday: "short", day: "numeric", month: "short", year: "numeric" }
);

updateRejectionField();
renderApplications();
updateNavigation();
