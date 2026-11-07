// ================= Supabase =================
const db = window.supabase.createClient(
const SUPABASE_URL = "https://gqdfyvgjemxjbxwyfttr.supabase.co";
const SUPABASE_ANON_KEY = ""sb_publishable_UF7m6aR7gRZRIG2X-jHX_g_gijBbU1R";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================= ตัวแปรหลัก =================
let currentUser = null;
let currentRole = "worker";
let workers = [];
let logs = [];
let attendance = [];

// ================= helper =================
const $ = (id) => document.getElementById(id);

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el.timer);
  el.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function thaiDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

function todayISO() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function formatBaht(n) {
  return n.toLocaleString("th-TH");
}

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function showAuthError(msg) {
  $("auth-error").textContent = msg;
}

function clearAuthError() {
  $("auth-error").textContent = "";
}

// ================= โหลดข้อมูล =================
async function loadWorkers() {
  if (!currentUser) return;

  const { data, error } = await db
    .from("workers")
    .select("*")
    .eq("owner_id", currentUser.id);

  if (error) {
    console.error("loadWorkers error", error);
    return;
  }

  workers = data || [];
}

async function loadLogs() {
  if (!currentUser) return;

  const { data, error } = await db
    .from("work_logs")
    .select("*")
    .eq("owner_id", currentUser.id);

  if (error) {
    console.error("loadLogs error", error);
    return;
  }

  logs = data || [];
}

async function loadAttendance() {
  if (!currentUser) return;

  const { data, error } = await db
    .from("attendance")
    .select("*")
    .eq("owner_id", currentUser.id);

  if (error) {
    console.error("loadAttendance error", error);
    return;
  }

  attendance = data || [];
}

async function loadAll() {
  await loadWorkers();
  await loadLogs();
  await loadAttendance();
  renderAll();
}

// ================= render =================
function renderWorkers() {
  const list = $("worker-list");

  if (!workers.length) {
    list.innerHTML = `<div class="empty">ยังไม่มีคนงาน</div>`;
    return;
  }

  list.innerHTML = workers
    .map((w) => {
      const days = new Set(
        logs.filter((l) => l.worker_id === w.id).map((l) => l.work_date)
      ).size;

      return `
        <div class="item-card">
          <div class="info">
            <div class="name">${escapeHTML(w.name)}</div>
            <div class="meta">${w.phone ? escapeHTML(w.phone) : ""} ${w.wage ? "• " + formatBaht(w.wage) + " บาท/วัน" : ""}</div>
            ${w.role ? `<span class="badge badge-role">${escapeHTML(w.role)}</span>` : ""}
            <span class="badge badge-days">${days} วัน</span>
          </div>
          <div class="actions">
            <button class="btn-danger-ghost" data-edit="${w.id}">แก้ไข</button>
            <button class="btn-danger-ghost" data-del="${w.id}">ลบ</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderLogForm() {
  const sel = $("l-worker");
  const prev = sel.value;

  sel.innerHTML =
    `<option value="" disabled selected>เลือกคนงาน</option>` +
    workers
      .map((w) => `<option value="${w.id}">${escapeHTML(w.name)}</option>`)
      .join("");

  if (prev && workers.some((w) => String(w.id) === prev)) {
    sel.value = prev;
  }
}

function renderLogs() {
  const list = $("log-list");

  if (!logs.length) {
    list.innerHTML = `<div class="empty">ยังไม่มีบันทึกงาน</div>`;
    return;
  }

  const sorted = [...logs].sort((a, b) => b.work_date.localeCompare(a.work_date));

  list.innerHTML = sorted
    .map((l) => {
      const w = workers.find((x) => x.id === l.worker_id);
      return `
        <div class="item-card">
          <div class="info">
            <div class="name">${escapeHTML(w ? w.name : "ไม่ทราบชื่อ")}</div>
            <div class="meta">${thaiDate(l.work_date)}</div>
            <div class="meta">${escapeHTML(l.task)}</div>
          </div>
          <div class="actions">
            <button class="btn-danger-ghost" data-dellog="${l.id}">ลบ</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSummary() {
  const body = $("summary-body");

  if (!workers.length) {
    body.innerHTML = `<tr><td colspan="6"><div class="empty">ยังไม่มีข้อมูล</div></td></tr>`;
    return;
  }

  let totalAll = 0;

  const rows = workers.map((w) => {
    const dates = new Set(
      logs.filter((l) => l.worker_id === w.id).map((l) => l.work_date)
    );

    const days = dates.size;
    const total = w.wage ? days * w.wage : 0;

    if (total) totalAll += total;

    const last = dates.size
      ? thaiDate([...dates].sort().pop())
      : "-";

    return `
      <tr>
        <td>${escapeHTML(w.name)}</td>
        <td>${escapeHTML(w.role || "-")}</td>
        <td class="num">${days}</td>
        <td class="num">${w.wage ? formatBaht(w.wage) : "-"}</td>
        <td class="num">${total ? formatBaht(total) : "-"}</td>
        <td>${last}</td>
      </tr>
    `;
  });

  rows.push(`
    <tr class="total-row">
      <td colspan="4">รวมทั้งหมด</td>
      <td class="num">${formatBaht(totalAll)}</td>
      <td></td>
    </tr>
  `);

  body.innerHTML = rows.join("");
}

function renderAll() {
  renderWorkers();
  renderLogForm();
  renderLogs();
  renderSummary();
}

// ================= คนงาน =================
$("worker-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const id = $("worker-id").value;
  const name = $("w-name").value.trim();

  if (!name) return;

  const payload = {
    owner_id: currentUser.id,
    name,
    role: $("w-role").value.trim(),
    phone: $("w-phone").value.trim(),
    wage: $("w-wage").value ? Number($("w-wage").value) : null
  };

  if (id) {
    const { error } = await db
      .from("workers")
      .update(payload)
      .eq("id", id);

    if (error) {
      console.error(error);
      toast("บันทึกไม่สำเร็จ");
      return;
    }

    toast("แก้ไขคนงานแล้ว");
  } else {
    const { error } = await db
      .from("workers")
      .insert([payload]);

    if (error) {
      console.error(error);
      toast("บันทึกไม่สำเร็จ");
      return;
    }

    toast("เพิ่มคนงานแล้ว");
  }

  resetWorkerForm();
  await loadAll();
});

function resetWorkerForm() {
  $("worker-form").reset();
  $("worker-id").value = "";
  $("worker-submit-btn").textContent = "บันทึกคนงาน";
  $("worker-cancel-btn").classList.add("hidden");
}

$("worker-list").addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit]");
  const delBtn = e.target.closest("[data-del]");

  if (editBtn) {
    const w = workers.find((x) => String(x.id) === editBtn.dataset.edit);
    if (!w) return;

    $("worker-id").value = w.id;
    $("w-name").value = w.name;
    $("w-role").value = w.role || "";
    $("w-phone").value = w.phone || "";
    $("w-wage").value = w.wage || "";

    $("worker-submit-btn").textContent = "อัปเดตคนงาน";
    $("worker-cancel-btn").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (delBtn) {
    const id = delBtn.dataset.del;
    if (!confirm("ยืนยันลบคนงานนี้?")) return;

    const { error } = await db
      .from("workers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      toast("ลบไม่สำเร็จ");
      return;
    }

    toast("ลบคนงานแล้ว");
    await loadAll();
  }
});

$("worker-cancel-btn").addEventListener("click", resetWorkerForm);

// ================= บันทึกงาน =================
$("log-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const workerId = Number($("l-worker").value);
  const workDate = $("l-date").value;
  const task = $("l-task").value.trim();

  if (!workerId || !workDate || !task) return;

  const { error } = await db
    .from("work_logs")
    .insert([
      {
        owner_id: currentUser.id,
        worker_id: workerId,
        work_date: workDate,
        task
      }
    ]);

  if (error) {
    console.error(error);
    toast("บันทึกไม่สำเร็จ");
    return;
  }

  toast("บันทึกงานแล้ว");
  $("log-form").reset();
  $("l-date").value = todayISO();

  await loadAll();
});

$("log-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-dellog]");
  if (!btn) return;

  if (!confirm("ยืนยันลบบันทึกนี้?")) return;

  const { error } = await db
    .from("work_logs")
    .delete()
    .eq("id", btn.dataset.dellog);

  if (error) {
    console.error(error);
    toast("ลบไม่สำเร็จ");
    return;
  }

  toast("ลบบันทึกแล้ว");
  await loadAll();
});

// ================= แท็บ =================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    ["workers", "logs", "summary"].forEach((t) => {
      $(`tab-${t}`).classList.toggle("hidden", t !== btn.dataset.tab);
    });

    if (btn.dataset.tab === "summary") renderSummary();
  });
});

// ================= เช็คอิน =================
$("self-checkin-btn").addEventListener("click", async () => {
  if (!currentUser) return;

  const today = todayISO();

  const already = attendance.some(
    (a) => a.user_id === currentUser.id && a.work_date === today
  );

  if (already) {
    toast("คุณเช็คอินวันนี้แล้ว");
    return;
  }

  const { error } = await db
    .from("attendance")
    .insert([
      {
        owner_id: currentUser.id,
        user_id: currentUser.id,
        work_date: today
      }
    ]);

  if (error) {
    console.error(error);
    toast("เช็คอินไม่สำเร็จ");
    return;
  }

  toast("เช็คอินสำเร็จ");
  await loadAttendance();
  updateCheckinUI();
});

function updateCheckinUI() {
  const box = $("self-checkin-box");
  const btn = $("self-checkin-btn");

  if (!currentUser) {
    box.classList.add("hidden");
    return;
  }

  const today = todayISO();
  const already = attendance.some(
    (a) => a.user_id === currentUser.id && a.work_date === today
  );

  if (already) {
    btn.textContent = "เช็คอินแล้ว";
    btn.disabled = true;
  } else {
    btn.textContent = "เช็คอินวันนี้";
    btn.disabled = false;
  }
}

// ================= สมัคร / เข้าสู่ระบบ =================
$("signup-btn").addEventListener("click", async () => {
  clearAuthError();

  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;

  if (!email || !password) {
    showAuthError("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  const { data, error } = await db.auth.signUp({
    email,
    password
  });

  if (error) {
    showAuthError(error.message);
    return;
  }

  if (data?.user) {
    await applyUser(data.user);
    toast("สมัครและเข้าสู่ระบบแล้ว");
  }
});

$("login-btn").addEventListener("click", async () => {
  clearAuthError();

  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;

  if (!email || !password) {
    showAuthError("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showAuthError(error.message);
    return;
  }

  $("auth-password").value = "";
  toast("เข้าสู่ระบบแล้ว");

  if (data?.user) {
    await applyUser(data.user);
  } else {
    const { data: sessionData } = await db.auth.getSession();
    if (sessionData?.session?.user) {
      await applyUser(sessionData.session.user);
    }
  }
});

// ================= สถานะผู้ใช้ =================
async function applyUser(user) {
  currentUser = user;

  const { data, error } = await db
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error("profiles error", error);
    currentRole = "worker";
  } else {
    currentRole = data?.role || "worker";
  }

  updatePermissionUI();
  await loadAll();
}

function updatePermissionUI() {
  const overlay = $("auth-overlay");
  const checkinBox = $("self-checkin-box");

  if (!currentUser) {
    overlay.classList.remove("hidden");
    checkinBox.classList.add("hidden");
    return;
  }

  overlay.classList.add("hidden");

  if (currentRole === "worker") {
    checkinBox.classList.remove("hidden");
  } else {
    checkinBox.classList.add("hidden");
  }

  updateCheckinUI();
}

// ================= เริ่มระบบ =================
db.auth.onAuthStateChange(async (_event, session) => {
  if (session?.user) {
    await applyUser(session.user);
  } else {
    currentUser = null;
    updatePermissionUI();
  }
});

(async () => {
  const { data } = await db.auth.getSession();

  if (data?.session?.user) {
    await applyUser(data.session.user);
  } else {
    updatePermissionUI();
  }
})();
