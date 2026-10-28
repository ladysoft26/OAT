
"use strict";

// ========================================
// OPPORTUNITY TRACKER
// Works with index.html and styles.css
// This version saves data in this browser.
// Account/database saving will be added later.
// ========================================

const STORAGE_KEY = "opportunityTrackerApplicationsV1";

const form = document.getElementById("applicationForm");
const applicationList = document.getElementById("applicationList");
const emptyMessage = document.getElementById("emptyMessage");
const searchInput = document.getElementById("search");
const typeFilter = document.getElementById("typeFilter");
const statusFilter = document.getElementById("statusFilter");
const fundingFilter = document.getElementById("fundingFilter");
const deadlineNotice = document.getElementById("deadlineNotice");

let applications = loadApplications();
let editingId = null;

function loadApplications() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not load saved applications:", error);
    return [];
  }
}

function saveApplications() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    return true;
  } catch (error) {
    alert("Your browser could not save these records. Try exporting your data.");
    console.error("Could not save applications:", error);
    return false;
  }
}

function getValue(id) {
  return document.getElementById(id).value.trim();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysUntil(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString + "T00:00:00");
  const today = new Date(todayString() + "T00:00:00");

  return Math.round((date - today) / 86400000);
}

function formatDate(dateString) {
  if (!dateString) return "No deadline set";

  const date = new Date(dateString + "T00:00:00");

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function getDeadlineLabel(deadline) {
  const days = daysUntil(deadline);

  if (days === null) {
    return { text: "No deadline", className: "" };
  }

  if (days < 0) {
    return {
      text: `Overdue by ${Math.abs(days)} day(s)`,
      className: "overdue"
    };
  }

  if (days === 0) {
    return { text: "Deadline today!", className: "deadline" };
  }

  if (days <= 7) {
    return {
      text: `${days} day(s) left`,
      className: "deadline"
    };
  }

  return {
    text: `${days} days left`,
    className: ""
  };
}

function updateDashboard() {
  document.getElementById("totalCount").textContent =
    applications.length;

  document.getElementById("pendingCount").textContent =
    applications.filter(item => item.status === "Not applied").length;

  document.getElementById("appliedCount").textContent =
    applications.filter(item => item.status === "Applied").length;

  document.getElementById("deadlineCount").textContent =
    applications.filter(item => {
      const days = daysUntil(item.deadline);
      return days !== null && days >= 0 && days <= 7;
    }).length;

  updateDeadlineNotice();
}

function updateDeadlineNotice() {
  const upcoming = applications
    .filter(item => {
      const days = daysUntil(item.deadline);
      return days !== null && days >= 0 && days <= 7;
    })
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const overdue = applications.filter(item => {
    const days = daysUntil(item.deadline);
    return days !== null && days < 0 &&
      !["Offer received", "Rejected"].includes(item.status);
  });

  if (upcoming.length === 0 && overdue.length === 0) {
    deadlineNotice.textContent =
      "You're all caught up! No upcoming deadlines in the next 7 days.";
    return;
  }

  const messages = [];

  if (upcoming.length > 0) {
    messages.push(
      `${upcoming.length} upcoming deadline(s): ` +
      upcoming.slice(0, 3).map(item =>
        `${item.name} (${formatDate(item.deadline)})`
      ).join(", ")
    );
  }

  if (overdue.length > 0) {
    messages.push(`${overdue.length} overdue application deadline(s).`);
  }

  deadlineNotice.textContent = messages.join(" ");
}

function getFilteredApplications() {
  const query = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;
  const status = statusFilter.value;
  const funding = fundingFilter.value;

  return applications
    .filter(item => {
      const searchable = [
        item.name,
        item.organization,
        item.location,
        item.notes,
        item.documents
      ].join(" ").toLowerCase();

      return (
        (!query || searchable.includes(query)) &&
        (!type || item.type === type) &&
        (!status || item.status === status) &&
        (!funding || item.funding === funding)
      );
    })
    .sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });
}

function renderApplications() {
  const filtered = getFilteredApplications();

  applicationList.replaceChildren();
  emptyMessage.style.display = filtered.length ? "none" : "block";

  if (filtered.length === 0) {
    emptyMessage.textContent = applications.length
      ? "No opportunities match your search or filters."
      : "No opportunities yet. Add your first one above!";
  }

  filtered.forEach(item => {
    const card = document.createElement("article");
    card.className = "application-card";

    const deadline = getDeadlineLabel(item.deadline);
    const statusClass = {
      "Applied": "applied",
      "Offer received": "offer",
      "In progress": "progress",
      "Interview": "interview",
      "Rejected": "rejected"
    }[item.status] || "";

    const safeUrl = getSafeUrl(item.url);

    card.innerHTML = `
      <h3>${escapeHTML(item.name)}</h3>
      <p>
        ${escapeHTML(item.type)}
        ${item.organization ? " · " + escapeHTML(item.organization) : ""}
        ${item.location ? " · " + escapeHTML(item.location) : ""}
      </p>

      <div class="record-details">
        <span class="pill ${statusClass}">
          ${escapeHTML(item.status)}
        </span>
        <span class="pill">
          ${escapeHTML(item.funding)}
        </span>
        <span class="pill ${deadline.className}">
          ${escapeHTML(formatDate(item.deadline))}
          ${item.deadline ? " · " + escapeHTML(deadline.text) : ""}
        </span>
      </div>

      ${item.documents ? `
        <p><strong>Documents:</strong> ${escapeHTML(item.documents)}</p>
      ` : ""}

      ${item.notes ? `
        <p><strong>Notes:</strong> ${escapeHTML(item.notes)}</p>
      ` : ""}

      ${safeUrl ? `
        <p><a href="${escapeHTML(safeUrl)}"
          target="_blank" rel="noopener noreferrer">
          Open application website ↗
        </a></p>
      ` : ""}

      <div class="card-actions">
        <button type="button" data-action="edit"
          data-id="${escapeHTML(item.id)}">Edit</button>
        <button type="button" data-action="toggle"
          data-id="${escapeHTML(item.id)}">
          ${item.status === "Applied" ? "Mark not applied" : "Mark applied"}
        </button>
        <button type="button" data-action="export-one"
          data-id="${escapeHTML(item.id)}">Export record</button>
        <button type="button" data-action="delete"
          data-id="${escapeHTML(item.id)}">Delete</button>
      </div>
    `;

    applicationList.appendChild(card);
  });

  updateDashboard();
}

function getSafeUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function clearForm() {
  form.reset();
  editingId = null;

  const submitButton = form.querySelector('[type="submit"]');
  submitButton.textContent = "Add opportunity";
}

function fillForm(item) {
  const fields = [
    "type", "name", "organization", "location",
    "deadline", "status", "funding", "url",
    "documents", "notes"
  ];

  fields.forEach(field => {
    document.getElementById(field).value = item[field] || "";
  });

  editingId = item.id;

  const submitButton = form.querySelector('[type="submit"]');
  submitButton.textContent = "Save changes";

  form.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("name").focus();
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const name = getValue("name");

  if (!name) {
    alert("Please enter a job or scholarship name.");
    return;
  }

  const urlValue = getValue("url");

  if (urlValue && !getSafeUrl(urlValue)) {
    alert("Please enter a valid website link starting with http:// or https://.");
    return;
  }

  const record = {
    id: editingId || createId(),
    type: getValue("type"),
    name,
    organization: getValue("organization"),
    location: getValue("location"),
    deadline: getValue("deadline"),
    status: getValue("status"),
    funding: getValue("funding"),
    url: urlValue,
    documents: getValue("documents"),
    notes: getValue("notes"),
    updatedAt: new Date().toISOString()
  };

  if (editingId) {
    applications = applications.map(item =>
      item.id === editingId ? record : item
    );
  } else {
    applications.push(record);
  }

  if (!saveApplications()) return;

  clearForm();
  renderApplications();
});

applicationList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  const item = applications.find(record => record.id === id);

  if (!item) return;

  if (action === "edit") {
    fillForm(item);
  }

  if (action === "toggle") {
    item.status = item.status === "Applied" ? "Not applied" : "Applied";
    item.updatedAt = new Date().toISOString();

    if (saveApplications()) renderApplications();
  }

  if (action === "delete") {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;

    applications = applications.filter(record => record.id !== id);

    if (editingId === id) clearForm();

    if (saveApplications()) renderApplications();
  }

  if (action === "export-one") {
    downloadCSV([item], "opportunity-record.csv");
  }
});

[searchInput, typeFilter, statusFilter, fundingFilter].forEach(control => {
  control.addEventListener("input", renderApplications);
  control.addEventListener("change", renderApplications);
});

function downloadCSV(records, filename) {
  if (!records.length) {
    alert("There are no records to export.");
    return;
  }

  const columns = [
    "type", "name", "organization", "location",
    "deadline", "status", "funding", "url",
    "documents", "notes", "updatedAt"
  ];

  function csvCell(value) {
    let text = String(value ?? "");

    // Prevent spreadsheet formulas from running when exported.
    if (/^[\s]*[=+\-@]/.test(text)) {
      text = "'" + text;
    }

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

const exportButton = document.createElement("button");
exportButton.type = "button";
exportButton.className = "primary-button";
exportButton.textContent = "Export all records (CSV)";
exportButton.style.marginBottom = "16px";

exportButton.addEventListener("click", () => {
  downloadCSV(applications, "my-opportunities.csv");
});

const listPanel = applicationList.closest(".panel");
listPanel.insertBefore(exportButton, applicationList);

renderApplications();
