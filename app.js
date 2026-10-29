
"use strict";

// =============================================
// OPPORTUNITY TRACKER
// Deep-blue dashboard compatible with existing HTML
// Browser storage version
// =============================================

const STORAGE_KEY = "opportunityTrackerApplicationsV1";

const OPPORTUNITY_TYPES = [
  "Scholarship", "Job", "Internship", "Grant",
  "Fellowship", "Volunteering", "Others"
];

const APPLICATION_STATUSES = [
  "Not applied", "In progress", "Applied",
  "Interview", "Offer received", "Rejected"
];

const FUNDING_OPTIONS = [
  "Unknown", "Fully funded", "Partially funded",
  "Self-funded", "Not applicable"
];

const form = document.getElementById("applicationForm");
const applicationList = document.getElementById("applicationList");
const emptyMessage = document.getElementById("emptyMessage");
const searchInput = document.getElementById("search");
const typeFilter = document.getElementById("typeFilter");
const statusFilter = document.getElementById("statusFilter");
const fundingFilter = document.getElementById("fundingFilter");
const deadlineNotice = document.getElementById("deadlineNotice");

let applications = [];
let editingId = null;

// ---------- Helpers ----------

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function getElement(id) {
  return document.getElementById(id);
}

function getValue(id) {
  const element = getElement(id);
  return element ? element.value.trim() : "";
}

function createId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  return Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}

function todayString() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

// Accept the YYYY-MM-DD value returned by an HTML date picker.
// Empty deadlines are allowed.
function validDate(value) {
  if (value === "" || value === null || value === undefined) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function daysUntil(value) {
  if (!value || !validDate(value)) {
    return null;
  }

  const deadline = Date.parse(value + "T00:00:00Z");
  const today = Date.parse(todayString() + "T00:00:00Z");

  return Math.round((deadline - today) / 86400000);
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

function getSafeUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch (error) {
    return "";
  }

  return "";
}

function showMessage(message) {
  alert(message);
}

// ---------- Record validation ----------

function normalizeRecord(record) {
  if (!record || typeof record !== "object") return null;

  if (typeof record.name !== "string" || !record.name.trim()) {
    return null;
  }

  const deadline = validDate(record.deadline)
    ? (record.deadline || "")
    : "";

  return {
    id: typeof record.id === "string" && record.id
      ? record.id : createId(),

    type: OPPORTUNITY_TYPES.includes(record.type)
      ? record.type : "Others",

    name: record.name.trim(),

    organization: safeText(record.organization),
    location: safeText(record.location),

    deadline,

    status: APPLICATION_STATUSES.includes(record.status)
      ? record.status : "Not applied",

    funding: FUNDING_OPTIONS.includes(record.funding)
      ? record.funding : "Unknown",

    url: getSafeUrl(record.url),
    documents: safeText(record.documents),
    notes: safeText(record.notes),
    updatedAt: safeText(record.updatedAt)
  };
}

// ---------- Browser storage ----------

function loadApplications() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) return [];

    return parsed.map(normalizeRecord).filter(Boolean);
  } catch (error) {
    console.error("Could not load saved records:", error);

    showMessage(
      "Your records could not be loaded. Do not clear your browser data. " +
      "Check the browser console for details."
    );

    return [];
  }
}

function saveApplications() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    return true;
  } catch (error) {
    console.error("Could not save records:", error);

    showMessage(
      "Your changes could not be saved. Browser storage may be full. " +
      "Export a backup if possible."
    );

    return false;
  }
}

// ---------- Deadline labels ----------

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
    return {
      text: "Deadline today!",
      className: "overdue"
    };
  }

  if (days <= 3) {
    return {
      text: `${days} day(s) left`,
      className: "overdue"
    };
  }

  if (days <= 7) {
    return {
      text: `${days} days left`,
      className: "deadline"
    };
  }

  return {
    text: `${days} days left`,
    className: ""
  };
}

// ---------- Dashboard ----------

function updateDashboard() {
  if (getElement("totalCount")) {
    getElement("totalCount").textContent = applications.length;
  }

  if (getElement("pendingCount")) {
    getElement("pendingCount").textContent =
      applications.filter(item => item.status === "Not applied").length;
  }

  if (getElement("appliedCount")) {
    getElement("appliedCount").textContent =
      applications.filter(item => item.status === "Applied").length;
  }

  if (getElement("deadlineCount")) {
    getElement("deadlineCount").textContent =
      applications.filter(item => {
        const days = daysUntil(item.deadline);
        return days !== null && days >= 0 && days <= 7;
      }).length;
  }

  updateDeadlineNotice();
}

function updateDeadlineNotice() {
  if (!deadlineNotice) return;

  const active = item =>
    !["Offer received", "Rejected"].includes(item.status);

  const upcoming = applications
    .filter(item => {
      const days = daysUntil(item.deadline);
      return active(item) && days !== null && days >= 0 && days <= 7;
    })
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const overdue = applications.filter(item => {
    const days = daysUntil(item.deadline);
    return active(item) && days !== null && days < 0;
  });

  const messages = [];

  if (overdue.length) {
    messages.push(`${overdue.length} overdue deadline(s).`);
  }

  if (upcoming.length) {
    messages.push(
      `${upcoming.length} upcoming deadline(s): ` +
      upcoming.slice(0, 3).map(item =>
        `${item.name} (${formatDate(item.deadline)})`
      ).join(", ") + "."
    );
  }

  deadlineNotice.textContent = messages.length
    ? messages.join(" ")
    : "You're all caught up! No active deadlines within the next 7 days.";

  deadlineNotice.classList.toggle("overdue", overdue.length > 0);
  deadlineNotice.classList.toggle(
    "deadline",
    overdue.length === 0 && upcoming.length > 0
  );
}

// ---------- Search and filters ----------

function getFilteredApplications() {
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const type = typeFilter ? typeFilter.value : "";
  const status = statusFilter ? statusFilter.value : "";
  const funding = fundingFilter ? fundingFilter.value : "";

  return applications
    .filter(item => {
      const searchable = [
        item.name, item.type, item.organization,
        item.location, item.funding, item.documents, item.notes
      ].join(" ").toLowerCase();

      return (
        (!query || searchable.includes(query)) &&
        (!type || item.type === type) &&
        (!status || item.status === status) &&
        (!funding || item.funding === funding)
      );
    })
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;

      return a.deadline.localeCompare(b.deadline);
    });
}

// ---------- Render opportunity cards ----------

function renderApplications() {
  if (!applicationList || !emptyMessage) {
    console.error(
      "Missing applicationList or emptyMessage element in index.html."
    );
    return;
  }

  const filtered = getFilteredApplications();

  applicationList.replaceChildren();
  emptyMessage.style.display = filtered.length ? "none" : "block";

  if (!filtered.length) {
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
        <p>
          <a href="${escapeHTML(safeUrl)}"
             target="_blank"
             rel="noopener noreferrer">
            Open application website ↗
          </a>
        </p>
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

// ---------- Form editing ----------

function clearForm() {
  form.reset();
  editingId = null;

  const submitButton = form.querySelector('[type="submit"]');

  if (submitButton) {
    submitButton.textContent = "Add opportunity";
  }
}

function fillForm(item) {
  [
    "type", "name", "organization", "location", "deadline",
    "status", "funding", "url", "documents", "notes"
  ].forEach(field => {
    const element = getElement(field);
    if (element) element.value = item[field] || "";
  });

  editingId = item.id;

  const submitButton = form.querySelector('[type="submit"]');

  if (submitButton) {
    submitButton.textContent = "Save changes";
  }

  form.scrollIntoView({ behavior: "smooth", block: "start" });

  if (getElement("name")) getElement("name").focus();
}

// ---------- Add and update records ----------

if (form) {
  form.addEventListener("submit", event => {
    event.preventDefault();

    const name = getValue("name");
    const type = getValue("type");
    const status = getValue("status");
    const funding = getValue("funding");

    // Read the date picker directly. Its value is YYYY-MM-DD or "".
    const deadlineInput = getElement("deadline");
    const deadline = deadlineInput ? deadlineInput.value : "";

    const url = getValue("url");

    if (!name) {
      showMessage("Please enter an opportunity name.");
      return;
    }

    if (!OPPORTUNITY_TYPES.includes(type)) {
      showMessage("Please select a valid opportunity type.");
      return;
    }

    if (!APPLICATION_STATUSES.includes(status)) {
      showMessage("Please select a valid application status.");
      return;
    }

    if (!FUNDING_OPTIONS.includes(funding)) {
      showMessage("Please select a valid funding option.");
      return;
    }

    if (deadline !== "" && !validDate(deadline)) {
      showMessage("Please select a valid date using the calendar.");
      return;
    }

    if (url && !getSafeUrl(url)) {
      showMessage("Enter a valid link beginning with http:// or https://.");
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
      url: getSafeUrl(url),
      documents: getValue("documents"),
      notes: getValue("notes"),
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
    showMessage("Opportunity saved successfully.");
  });
}

// ---------- Card actions ----------

if (applicationList) {
  applicationList.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const { action, id } = button.dataset;
    const item = applications.find(record => record.id === id);

    if (!item) return;

    if (action === "edit") {
      fillForm(item);
      return;
    }

    if (action === "toggle") {
      const previousStatus = item.status;

      const updated = {
        ...item,
        status: item.status === "Applied" ? "Not applied" : "Applied",
        updatedAt: new Date().toISOString()
      };

      const previous = applications;

      applications = applications.map(record =>
        record.id === id ? updated : record
      );

      if (!saveApplications()) {
        applications = previous;
        return;
      }

      renderApplications();
      return;
    }

    if (action === "delete") {
      if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) {
        return;
      }

      const previous = applications;

      applications = applications.filter(record => record.id !== id);

      if (!saveApplications()) {
        applications = previous;
        return;
      }

      if (editingId === id) clearForm();

      renderApplications();
      showMessage("Opportunity deleted.");
      return;
    }

    if (action === "export-one") {
      downloadCSV([item], "opportunity-record.csv");
    }
  });
}

// ---------- CSV export ----------

function downloadCSV(records, filename) {
  if (!records.length) {
    showMessage("There are no records to export.");
    return;
  }

  const columns = [
    "type", "name", "organization", "location", "deadline",
    "status", "funding", "url", "documents", "notes", "updatedAt"
  ];

  function csvCell(value) {
    let text = String(value ?? "");

    // Reduce the risk of spreadsheet formula execution.
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

// Add the export-all button if it is not already present.
const existingExportButton = getElement("exportAll");

if (existingExportButton) {
  existingExportButton.addEventListener("click", () => {
    downloadCSV(applications, "my-opportunities.csv");
  });
} else if (applicationList && applicationList.closest(".panel")) {
  const exportButton = document.createElement("button");

  exportButton.type = "button";
  exportButton.id = "exportAll";
  exportButton.className = "primary-button";
  exportButton.textContent = "Export all records (CSV)";
  exportButton.style.marginBottom = "16px";

  exportButton.addEventListener("click", () => {
    downloadCSV(applications, "my-opportunities.csv");
  });

  applicationList.closest(".panel").insertBefore(
    exportButton,
    applicationList
  );
}

// ---------- Search and filters ----------

[searchInput, typeFilter, statusFilter, fundingFilter]
  .filter(Boolean)
  .forEach(control => {
    control.addEventListener("input", renderApplications);
    control.addEventListener("change", renderApplications);
  });

// ---------- Initialise ----------

applications = loadApplications();
renderApplications();
