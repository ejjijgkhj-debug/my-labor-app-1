const db = window.supabase.createClient(
  "https://gqdfyvgjemxjbxwyfttr.supabase.co",
  "sb_publishable_UF7m6aR7gRZRIG2X-jHX_g_gijBbU1R"
);

const $ = id => document.getElementById(id);

const authOverlay = $("auth-overlay");
const authEmail = $("auth-email");
const authPassword = $("auth-password");
const authError = $("auth-error");
const loginBtn = $("login-btn");
const signupBtn = $("signup-btn");
const adminToggleBtn = $("admin-toggle-btn");

const workerForm = $("worker-form");
const workerName = $("w-name");
const workerRole = $("w-role");
const workerPhone = $("w-phone");
const workerWage = $("w-wage");
const workerList = $("worker-list");
const workerSearch = $("worker-search");

const logForm = $("log-form");
const logDate = $("log-date");
const logWorker = $("log-worker");
const logTask = $("log-task");
const logList = $("log-list");
const monthFilter = $("month-filter");

const summaryBody = $("summary-body");
const summaryMonth = $("summary-month");
const toast = $("toast");

let currentUser = null;
let userRole = "worker";
let workers = [];
let logs = [];
let toastTimer;
let authVersion = 0;
let loadVersion = 0;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.remove("hidden");
}

function clearAuthError() {
  authError.textContent = "";
  authError.classList.add("hidden");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return (Number(value) || 0).toLocaleString("th-TH", {
    maximumFractionDigits: 2
  });
}

function today() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function isAdmin() {
  return Boolean(currentUser) && userRole === "admin";
}

function errorText(error) {
  const message = error?.message || String(error);

  if (message.includes("Invalid login credentials")) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }

  if (message.includes("Email not confirmed")) {
    return "อีเมลนี้ยังไม่ได้ยืนยัน";
  }

  if (message.includes("User already registered")) {
    return "อีเมลนี้สมัครแล้ว ให้กดเข้าสู่ระบบ";
  }

  return message;
}

function updatePermissionUI() {
  authOverlay.classList.toggle("hidden", Boolean(currentUser));

  document.querySelectorAll(".admin-only").forEach(element => {
    element.classList.toggle("hidden", !isAdmin());
  });

  adminToggleBtn.textContent = currentUser
    ? "🔓 ออกจากระบบ"
    : "🔐 เข้าสู่ระบบ";
}

function renderWorkerOptions() {
  const selected = logWorker.value;

  logWorker.innerHTML =
    '<option value="">-- เลือกคนงาน --</option>';

  workers.forEach(worker => {
    const option = document.createElement("option");
    option.value = worker.id;
    option.textContent = worker.name;
    logWorker.appendChild(option);
  });

  if (workers.some(worker =>
    String(worker.id) === selected
  )) {
    logWorker.value = selected;
  }
}

function renderWorkers() {
  const keyword = (workerSearch?.value || "")
    .trim()
    .toLowerCase();

  const filtered = workers.filter(worker =>
    [worker.name, worker.role, worker.phone].some(value =>
      String(value ?? "").toLowerCase().includes(keyword)
    )
  );

  workerList.innerHTML = "";

  if (!filtered.length) {
    workerList.innerHTML =
      '<div class="empty">ไม่พบคนงาน</div>';
    return;
  }

  filtered.forEach(worker => {
    const card = document.createElement("div");
    card.className = "item-card";

    card.innerHTML = `
      <div class="info">
        <div class="name">${escapeHTML(worker.name)}</div>
        <div class="meta">
          ${escapeHTML(worker.phone || "")}
        </div>
        <span class="badge badge-role">
          ${escapeHTML(worker.role || "ไม่ระบุหน้าที่")}
        </span>
        <span class="badge badge-days">
          ${money(worker.wage)} บาท/วัน
        </span>
      </div>
      <div class="actions admin-only"></div>
    `;

    const actions = card.querySelector(".actions");

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-ghost";
    editButton.textContent = "แก้ไข";

    editButton.addEventListener("click", async () => {
      if (!isAdmin()) return;

      const name = prompt("ชื่อคนงาน", worker.name || "");
      if (name === null) return;

      const role = prompt("หน้าที่", worker.role || "");
      if (role === null) return;

      const phone = prompt("เบอร์โทร", worker.phone || "");
      if (phone === null) return;

      const wageText = prompt(
        "ค่าแรงต่อวัน",
        String(worker.wage ?? 0)
      );
      if (wageText === null) return;

      const wage = Number(wageText);

      if (!name.trim()) {
        showToast("กรุณากรอกชื่อคนงาน");
        return;
      }

      if (!wageText.trim() || !Number.isFinite(wage) || wage < 0) {
        showToast("ค่าแรงต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
        return;
      }

      const { data, error } = await db.from("workers")
        .update({
          name: name.trim(),
          role: role.trim(),
          phone: phone.trim(),
          wage
        })
        .eq("id", worker.id)
        .eq("owner_id", currentUser.id)
        .select("id");

      if (error) {
        showToast("แก้ไขไม่สำเร็จ: " + error.message);
        return;
      }

      if (!data?.length) {
        showToast("ไม่ได้แก้ไขข้อมูล กรุณาตรวจสอบสิทธิ์");
        return;
      }

      await loadData();
      showToast("แก้ไขคนงานแล้ว");
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-danger-ghost";
    deleteButton.textContent = "ลบ";

    deleteButton.addEventListener("click", async () => {
      if (!isAdmin()) return;

      if (!confirm("ต้องการลบคนงานนี้หรือไม่?")) return;

      const { data, error } = await db.from("workers")
        .delete()
        .eq("id", worker.id)
        .eq("owner_id", currentUser.id)
        .select("id");

      if (error) {
        showToast("ลบไม่สำเร็จ: " + error.message);
        return;
      }

      if (!data?.length) {
        showToast("ไม่ได้ลบข้อมูล กรุณาตรวจสอบสิทธิ์");
        return;
      }

      await loadData();
      showToast("ลบคนงานแล้ว");
    });

    actions.append(editButton, deleteButton);
    workerList.appendChild(card);
  });

  updatePermissionUI();
}

function renderLogs() {
  const month = monthFilter?.value || "";

  const filtered = logs.filter(log =>
    !month || String(log.work_date).startsWith(month)
  );

  logList.innerHTML = "";

  if (!filtered.length) {
    logList.innerHTML =
      '<div class="empty">ไม่พบบันทึกงาน</div>';
    return;
  }

  filtered.forEach(log => {
    const worker = workers.find(item =>
      String(item.id) === String(log.worker_id)
    );

    const card = document.createElement("div");
    card.className = "item-card";

    card.innerHTML = `
      <div class="info">
        <div class="name">
          ${escapeHTML(worker?.name || "ไม่พบคนงาน")}
        </div>
        <div class="meta">
          ${escapeHTML(formatDate(log.work_date))}
          ${log.task ? " • " + escapeHTML(log.task) : ""}
        </div>
      </div>
      <div class="actions admin-only"></div>
    `;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-danger-ghost";
    deleteButton.textContent = "ลบ";

    deleteButton.addEventListener("click", async () => {
      if (!isAdmin()) return;

      if (!confirm("ต้องการลบบันทึกงานนี้หรือไม่?")) return;

      const { data, error } = await db.from("work_logs")
        .delete()
        .eq("id", log.id)
        .eq("owner_id", currentUser.id)
        .select("id");

      if (error) {
        showToast("ลบไม่สำเร็จ: " + error.message);
        return;
      }

      if (!data?.length) {
        showToast("ไม่ได้ลบข้อมูล กรุณาตรวจสอบสิทธิ์");
        return;
      }

      await loadData();
      showToast("ลบบันทึกงานแล้ว");
    });

    card.querySelector(".actions").appendChild(deleteButton);
    logList.appendChild(card);
  });

  updatePermissionUI();
}

function renderSummary() {
  const month = summaryMonth?.value || "";

  const filtered = logs.filter(log =>
    !month || String(log.work_date).startsWith(month)
  );

  summaryBody.innerHTML = "";

  if (!workers.length) {
    summaryBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">
          ยังไม่มีข้อมูลคนงาน
        </td>
      </tr>
    `;
    return;
  }

  let total = 0;

  workers.forEach(worker => {
    const dates = new Set(
      filtered
        .filter(log =>
          String(log.worker_id) === String(worker.id)
        )
        .map(log => log.work_date)
    );

    const amount = dates.size * (Number(worker.wage) || 0);
    total += amount;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHTML(worker.name)}</td>
      <td>${escapeHTML(worker.role || "-")}</td>
      <td class="num">${dates.size}</td>
      <td class="num">${money(worker.wage)}</td>
      <td class="num">${money(amount)}</td>
    `;

    summaryBody.appendChild(row);
  });

  const totalRow = document.createElement("tr");
  totalRow.className = "total-row";

  totalRow.innerHTML = `
    <td colspan="4">รวมทั้งหมด</td>
    <td class="num">${money(total)} บาท</td>
  `;

  summaryBody.appendChild(totalRow);
}

function renderAll() {
  renderWorkerOptions();
  renderWorkers();
  renderLogs();
  renderSummary();
  updatePermissionUI();
}

async function loadData() {
  if (!currentUser) return;

  const userId = currentUser.id;
  const version = ++loadVersion;

  const [workerResult, logResult] = await Promise.all([
    db.from("workers")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),

    db.from("work_logs")
      .select("*")
      .eq("owner_id", userId)
      .order("work_date", { ascending: false })
  ]);

  if (version !== loadVersion || currentUser?.id !== userId) {
    return;
  }

  if (workerResult.error) throw workerResult.error;
  if (logResult.error) throw logResult.error;

  workers = workerResult.data || [];
  logs = logResult.data || [];

  renderAll();
}

async function applyUser(user) {
  const version = ++authVersion;
  ++loadVersion;

  currentUser = user || null;
  userRole = "worker";
  workers = [];
  logs = [];

  renderAll();

  if (!user) return;

  try {
    const { data, error } = await db.from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (version !== authVersion) return;
    if (error) throw error;

    userRole = data?.role || "worker";
    updatePermissionUI();

    await loadData();

    if (!data && version === authVersion) {
      showToast(
        "ไม่พบโปรไฟล์บัญชี กรุณาตรวจสอบตาราง profiles"
      );
    }
  } catch (error) {
    if (version !== authVersion) return;

    console.error(error);
    showToast("โหลดข้อมูลไม่สำเร็จ: " + errorText(error));
  }
}

loginBtn.addEventListener("click", async () => {
  clearAuthError();

  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    showAuthError("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showAuthError(errorText(error));
    return;
  }

  authPassword.value = "";
  showToast("เข้าสู่ระบบแล้ว");
});

signupBtn.addEventListener("click", async () => {
  clearAuthError();

  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !authEmail.checkValidity() || password.length < 6) {
    showAuthError(
      "กรอกอีเมลให้ถูกต้อง และรหัสผ่านอย่างน้อย 6 ตัวอักษร"
    );
    return;
  }

  const { data, error } = await db.auth.signUp({
    email,
    password
  });

  if (error) {
    showAuthError(errorText(error));
    return;
  }

  authPassword.value = "";

  if (data.session) {
    showToast("สมัครและเข้าใช้งานสำเร็จแล้ว");
  } else {
    showAuthError(
      "สมัครสำเร็จ แต่อีเมลนี้อาจต้องยืนยันก่อนเข้าใช้งาน"
    );
  }
});

adminToggleBtn.addEventListener("click", async () => {
  if (!currentUser) {
    authOverlay.classList.remove("hidden");
    authEmail.focus();
    return;
  }

  const { error } = await db.auth.signOut();

  if (error) {
    showToast("ออกจากระบบไม่สำเร็จ: " + error.message);
    return;
  }

  await applyUser(null);
  showToast("ออกจากระบบแล้ว");
});

document.querySelectorAll(".tab-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    ["workers", "logs", "summary"].forEach(name => {
      $("tab-" + name).classList.toggle(
        "hidden",
        button.dataset.tab !== name
      );
    });
  });
});

workerForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return;

  const name = workerName.value.trim();
  const wage = Number(workerWage.value);

  if (!name) {
    showToast("กรุณากรอกชื่อคนงาน");
    return;
  }

  if (!Number.isFinite(wage) || wage < 0) {
    showToast("ค่าแรงต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
    return;
  }

  const { error } = await db.from("workers").insert({
    owner_id: currentUser.id,
    name,
    role: workerRole.value.trim(),
    phone: workerPhone.value.trim(),
    wage
  });

  if (error) {
    showToast("บันทึกไม่สำเร็จ: " + error.message);
    return;
  }

  workerForm.reset();
  await loadData();
  showToast("เพิ่มคนงานแล้ว");
});

logForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return;

  const workerId = logWorker.value;
  const workDate = logDate.value;

  if (!workerId || !workDate) {
    showToast("กรุณาเลือกคนงานและวันที่");
    return;
  }

  if (!workers.some(worker =>
    String(worker.id) === workerId
  )) {
    showToast("ไม่พบคนงานที่เลือก");
    return;
  }

  if (logs.some(log =>
    String(log.worker_id) === workerId &&
    log.work_date === workDate
  )) {
    showToast("คนงานนี้มีบันทึกวันที่เลือกแล้ว");
    return;
  }

  const { error } = await db.from("work_logs").insert({
    owner_id: currentUser.id,
    worker_id: workerId,
    work_date: workDate,
    task: logTask.value.trim()
  });

  if (error) {
    showToast("บันทึกไม่สำเร็จ: " + error.message);
    return;
  }

  logTask.value = "";
  await loadData();
  showToast("บันทึกวันทำงานแล้ว");
});

workerSearch?.addEventListener("input", renderWorkers);
monthFilter?.addEventListener("change", renderLogs);
summaryMonth?.addEventListener("change", renderSummary);

db.auth.onAuthStateChange((_event, session) => {
  setTimeout(() => {
    void applyUser(session?.user || null);
  }, 0);
});

logDate.value = today();
renderAll();
