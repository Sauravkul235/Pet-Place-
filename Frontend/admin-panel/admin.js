const API_BASE_URL = "http://localhost:4000/api";
console.log('Admin Page Loaded - API Base:', API_BASE_URL);

// ====================== HELPER FUNCTIONS ========================= 
function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.getElementById(viewId).classList.remove("hidden");
  document.getElementById("pageTitle").textContent =
    viewId.replace("view-", "").replace(/-/g, " ").toUpperCase();
  console.log('Switched to view:', viewId);
}

function showConfirm(message, callback) {
  const modal = document.getElementById("confirmModal");
  document.getElementById("confirmMessage").textContent = message;
  modal.classList.remove("hidden");

  const yesBtn = document.getElementById("confirmYes");
  const noBtn = document.getElementById("confirmNo");

  yesBtn.onclick = () => {
    modal.classList.add("hidden");
    callback(true);
  };
  noBtn.onclick = () => {
    modal.classList.add("hidden");
    callback(false);
  };
}
  
//---- products -----
 async function loadProducts(category = "") {
    const productsTableWrap = document.getElementById("productsTableWrap");
    productsTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted);">Loading products...</div>';
    try {
      const res = await fetch(`${API_BASE_URL}/products`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        console.warn('Products fetch failed:', res.status);
        productsTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error loading products or not authenticated.</div>';
        return;
      }
      const data = await res.json();
      let products = data.products || [];
      if (category) {      
        products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
      }
      if (products.length > 0) {
        productsTableWrap.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(p => `
                <tr>
                  <td>${p.id}</td>
                  <td>${p.name}</td>
                  <td>${p.category}</td>
                  <td>₹${p.price}</td>
                  <td>${p.stock}</td>
                  <td>
                    <button onclick="editProduct(${p.id})">Edit</button>
                    <button onclick="showConfirm('Delete ${p.name}?', () => deleteProduct(${p.id}), () => console.log('Deletion cancelled for ${p.name}'))">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else {
        productsTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted);">No products found.</div>';
      }
    } catch (err) {
      console.error('Load products error:', err);
      productsTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error: ' + err.message + '</div>';
    }
  }

  function showConfirm(message, onYes, onNo = () => {}) {
    console.log('showConfirm called with message:', message);  
    const modal = document.getElementById("confirmModal");
    document.getElementById("confirmMessage").textContent = message;
    modal.classList.remove("hidden");
    document.getElementById("confirmYes").onclick = () => {
      console.log('Yes clicked');  
      modal.classList.add("hidden");
      onYes();
    };
    document.getElementById("confirmNo").onclick = () => {
      console.log('No clicked');  
      modal.classList.add("hidden");
      onNo();
    };
  }
  // Add Product
  async function addProduct() {
    console.log('Opening add product modal...');
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('productForm').reset();
    document.getElementById('productModal').classList.remove('hidden');
    document.getElementById('productForm').onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      console.log('Sending product data:', data); 
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Not authenticated');
        const res = await fetch(`${API_BASE_URL}/products`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        console.log('Response status:', res.status); 
        if (res.ok) {
          loadProducts();
          document.getElementById('productModal').classList.add('hidden');
          alert('Product added successfully!');
        } else {
          const errorText = await res.text();
          console.error('Add failed response:', errorText);  // Debug: Log error
          alert('Add failed: ' + errorText);
        }
      } catch (err) {
        console.error('Error:', err); 
        alert('Error: ' + err.message);
      }
    };
    document.getElementById("cancelProductBtn").addEventListener("click", () => {
      document.getElementById("productModal").classList.add("hidden");
    });
  }
//edit product
async function editProduct(id) {
  console.log('Editing product ID:', id);
  try {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/products/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error(res.status);
    const product = await res.json();
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.querySelector('[name="name"]').value = product.name;
    document.querySelector('[name="category"]').value = product.category;
    document.querySelector('[name="price"]').value = product.price;
    document.querySelector('[name="stock"]').value = product.stock;
    document.querySelector('[name="image_url"]').value = product.image_url;
    document.querySelector('[name="description"]').value = product.description;
    document.getElementById('productModal').classList.remove('hidden');
    document.getElementById('productForm').onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      try {
        const updateRes = await fetch(`${API_BASE_URL}/products/${id}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const updateData = await updateRes.text();  // Read once as text
        if (updateRes.ok) {
          console.log('PUT response:', updateData);
          loadProducts();
          document.getElementById('productModal').classList.add('hidden');
        } else {
          console.error('PUT failed:', updateData);
          alert('Edit failed: ' + updateData);
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    };
    document.getElementById("cancelProductBtn").addEventListener("click", () => {
      document.getElementById("productModal").classList.add("hidden");
    });
  } catch (err) {
    alert('Error loading product: ' + err.message);
  }
}
//delete product
  async function deleteProduct(id) {
    console.log('Deleting product ID:', id);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok){
       loadProducts();
      }
      else alert('Delete failed: ' + await res.text());
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

//---- orders ----
  // Load Orders
  async function loadOrders(status="") {
    const ordersTableWrap = document.getElementById("ordersTableWrap");
    ordersTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted);">Loading orders...</div>';
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        ordersTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error: Not authenticated.</div>';
        return;
      }
      const res = await fetch(`${API_BASE_URL}/orders`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      let orders = data.orders || [];
      if (status) {
        orders = orders.filter(o => o.status.toLowerCase() === status.toLowerCase());
      }
      ordersTableWrap.innerHTML = `
        <table>
          <thead><tr><th>ID</th><th>User</th><th>Product</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${orders.map(o => `<tr><td>${o.id}</td><td>${o.user_name}</td><td>${o.product_name}</td><td>₹${o.total_price}</td><td>${o.status}</td><td><select onchange="updateOrderStatus(${o.id}, this.value)"><option value="pending" ${o.status=='pending'?'selected':''}>Pending</option><option value="confirmed" ${o.status=='confirmed'?'selected':''}>Confirmed</option><option value="completed" ${o.status=='completed'?'selected':''}>Completed</option><option value="cancelled" ${o.status=='cancelled'?'selected':''}>Cancelled</option></select></td></tr>`).join('')}</tbody>
        </table>
      `;
    } catch (err) {
      ordersTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error: ' + err.message + '</div>';
    }
  }

// Update Order Status
  async function updateOrderStatus(id, status) {
    console.log('Updating order status:', id, status);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE_URL}/orders/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) loadOrders();
      else alert('Update failed: ' + await res.text());
    } catch (err) {
      alert('Error: ' + err.message);
    }
    
  }

// ========================= Export Orders CSV =========================
document.addEventListener('DOMContentLoaded', () => {
  const exportOrdersBtn = document.getElementById('exportOrdersBtn');

  if (exportOrdersBtn) {
    exportOrdersBtn.addEventListener('click', async () => {
      const start = prompt('Enter start date (YYYY-MM-DD):');
      const end = prompt('Enter end date (YYYY-MM-DD):');
      if (!start || !end) {
        alert('Both start and end dates are required!');
        return;
      }

      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE_URL}/orders/export?start=${start}&end=${end}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to fetch orders for export');

        const { orders } = await res.json();
        if (!orders || orders.length === 0) {
          alert('No orders found in this date range.');
          return;
        }

        let csv = 'Order ID,User,Product,Quantity,Total Price,Payment Method,Status,Date\n';

        orders.forEach(o => {
          csv += `"${o.id}","${o.user_name.replace(/"/g, '""')}","${o.product_name.replace(/"/g, '""')}",` +
                 `"${o.quantity}","₹${o.total_price}","${o.payment_method || 'N/A'}","${o.status}",` +
                 `"${new Date(o.created_at).toLocaleString()}"\n`;
        });

        // Trigger CSV download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders-${start}-to-${end}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        console.log('✅ Orders CSV exported successfully');
      } catch (err) {
        console.error('Export Orders Error:', err);
        alert('Export failed: ' + err.message);
      }
    });
  }
});

//----- appointments ----
  // Load Appointments
  async function loadAppointments(status="") {
    const appointmentsTableWrap = document.getElementById("appointmentsTableWrap");
    appointmentsTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted);">Loading appointments...</div>';
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        appointmentsTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error: Not authenticated.</div>';
        return;
      }
      const res = await fetch(`${API_BASE_URL}/appointments`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      let appointments = data.appointments || [];
      if (status) {
        appointments = appointments.filter(a => a.status.toLowerCase() === status.toLowerCase());
      }
      appointmentsTableWrap.innerHTML = `
        <table>
          <thead><tr><th>ID</th><th>User</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${appointments.map(a => `<tr><td>${a.id}</td><td>${a.customer_name}</td><td>${a.appointment_date}</td><td>${a.appointment_time}</td><td>${a.status}</td><td><select onchange="updateAppointmentStatus(${a.id}, this.value)"><option value="pending" ${a.status=='pending'?'selected':''}>Pending</option><option value="confirmed" ${a.status=='confirmed'?'selected':''}>Confirmed</option><option value="cancelled" ${a.status=='cancelled'?'selected':''}>Cancelled</option></select></td></tr>`).join('')}</tbody>
        </table>
      `;
    } catch (err) {
      appointmentsTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error: ' + err.message + '</div>';
    }
  }

  // Update Appointment Status
  async function updateAppointmentStatus(id, status) {
    console.log('Updating appointment status:', id, status);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE_URL}/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) loadAppointments();
      else alert('Update failed: ' + await res.text());
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

//---- users ----
  // Load Users
  async function loadUsers() {
    const usersTableWrap = document.getElementById("usersTableWrap");
    usersTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted);">Loading users...</div>';
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        usersTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error: Not authenticated.</div>';
        return;
      }
      const res = await fetch(`${API_BASE_URL}/users`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const users = data.users || [];
      usersTableWrap.innerHTML = `
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Created At</th></tr></thead>
          <tbody>${users.map(user => `<tr><td>${user.id}</td><td>${user.name}</td><td>${user.email}</td><td>${user.phone || 'N/A'}</td><td>${new Date(user.created_at).toLocaleString()}</td></tr>`).join('')}</tbody>
        </table>
      `;
    } catch (err) {
      usersTableWrap.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error: ' + err.message + '</div>';
    }
  }
  
// Export CSV fuctionality
document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('exportUsersBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      console.log('📥 Export CSV clicked');
      try {
        const res = await fetch(`${API_BASE_URL}/users`);
        if (!res.ok) throw new Error('API unavailable');
        const { users } = await res.json();
        if (users.length === 0) {
          alert('No users to export!');
          return;
        }

        let csv = 'ID,Name,Email,Phone/Mobile,Created At\n';
        users.forEach(user => {
          csv += `"${user.id}","${user.name.replace(/"/g, '""')}","${user.email.replace(/"/g, '""')}","${(user.phone || 'N/A').replace(/"/g, '""')}","${new Date(user.created_at).toLocaleString().replace(/"/g, '""')}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pet-place-users-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        console.log('✅ CSV exported');
      } catch (err) {
        console.error('Export error:', err);
        alert('Export failed: ' + err.message);
      }
    });
  }

  // Initial loads on page load
  console.log('🔄 Initial page load starting...');
  showView("view-dashboard");
  loadProducts(); 
  loadOrders();   
  loadAppointments(); 
  loadUsers();    
  updateDashboardStats();
  loadContactMessages();
  console.log('Initial load complete');
});

//---- contact messages ----
async function loadContactMessages() {
  try {
    const token = localStorage.getItem('token');
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${API_BASE_URL}/contact`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Failed to fetch messages");
    const data = await res.json();

    const tbody = document.getElementById("contactTableBody");
    tbody.innerHTML = "";

    if (!data.messages || data.messages.length === 0) {
      tbody.innerHTML = "<tr><td colspan='6'>No messages found</td></tr>";
      return;
    }

    data.messages.forEach(msg => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${msg.id}</td>
        <td>${msg.name}</td>
        <td>${msg.email}</td>
        <td>${msg.phone || "-"}</td>
        <td>${msg.message}</td>
        <td>${new Date(msg.created_at).toLocaleString()}</td>
      `;
      tbody.appendChild(row);
    });

  } catch (err) {
    console.error("❌ Error fetching contact messages:", err);
    const tbody = document.getElementById("contactTableBody");
    tbody.innerHTML = `<tr><td colspan='6'>Error loading messages</td></tr>`;
  }
}

// ---- dashboard stats ----
async function updateDashboardStats() {
  try {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Not authenticated");

    const [productsRes, ordersRes, appointmentsRes, usersRes] = await Promise.all([
      fetch(`${API_BASE_URL}/products`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/appointments`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/users`, { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    const [productsData, ordersData, appointmentsData, usersData] = await Promise.all([
      productsRes.json(),
      ordersRes.json(),
      appointmentsRes.json(),
      usersRes.json()
    ]);

    document.getElementById("statProducts").textContent = (productsData.products || []).length;
    document.getElementById("statOrders").textContent = (ordersData.orders || []).length;
    document.getElementById("statAppointments").textContent = (appointmentsData.appointments || []).length;
    document.getElementById("statUsers").textContent = (usersData.users || []).length;

  } catch (err) {
    console.error(" Error updating dashboard stats:", err);
  }
}

// --- menu navigation ---
document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    console.log('🖱️ Menu clicked:', btn.dataset.view);  
    document.querySelectorAll(".menu-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    showView(`view-${btn.dataset.view}`);
    if (btn.dataset.view === "users") {
      console.log('👥 Loading users on click...');
      loadUsers();
    }
  });
});

// event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".menu-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      showView(`view-${btn.dataset.view}`);
      if (btn.dataset.view === "products") loadProducts();
      if (btn.dataset.view === "orders") loadOrders();
      if (btn.dataset.view === "appointments") loadAppointments();
      if (btn.dataset.view === "users") loadUsers();
      if (btn.dataset.view === "dashboard") {
        updateDashboardStats();
        loadContactMessages();
      }
    });
  });

  document.getElementById('addProductBtn').addEventListener('click', addProduct);
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    alert('Logged out!');
    window.location.href = 'Frontend/cat place.html';
  });
  document.getElementById("cancelProductBtn").addEventListener("click", () => {
    document.getElementById("productModal").classList.add("hidden");
  });

  updateDashboardStats();
  loadContactMessages();
});

document.addEventListener("DOMContentLoaded", () => {
  //--- refresh button ---
  const refreshBtn = document.getElementById("refreshBtn");
  refreshBtn?.addEventListener("click", () => {
    const activeView = document.querySelector(".view:not(.hidden)");
    if (!activeView) return;
    const viewId = activeView.id;

    console.log(`Refreshing view: ${viewId}`);

    switch (viewId) {
      case "view-dashboard":
        updateDashboardStats();
        loadContactMessages();
        break;
      case "view-products":
        loadProducts();
        break;
      case "view-orders":
        loadOrders();
        break;
      case "view-appointments":
        loadAppointments();
        break;
      case "view-users":
        loadUsers();
        break;
      default:
        console.warn("Unknown view to refresh:", viewId);
    }
  });

  // product filter
  const productFilter = document.getElementById("productFilter");
  productFilter?.addEventListener("change", () => {
    const category = productFilter.value;
    loadProducts(category);
  });

  // ---order flter ---
  const orderStatusFilter = document.getElementById("orderStatusFilter");
  orderStatusFilter?.addEventListener("change", () => {
    const status = orderStatusFilter.value;
    loadOrders(status);
  });

  //--- appointment filter ---
  const appointmentFilter = document.getElementById("appointmentFilter");
  appointmentFilter?.addEventListener("change", () => {
    const status = appointmentFilter.value;
    loadAppointments(status);
  });

// --- serach filter ---
const globalSearch = document.getElementById("globalSearch");
globalSearch?.addEventListener("input", () => {
  const searchTerm = globalSearch.value.toLowerCase();
  const activeView = document.querySelector(".view:not(.hidden)");

  if (!activeView) return;

  const table = activeView.querySelector("table");
  if (!table) return;

  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((row) => {
    const match = row.innerText.toLowerCase().includes(searchTerm);
    row.style.display = match ? "" : "none";
  });
});

// --- clear button appointment ---
const clearOldAppointmentsBtn = document.getElementById("clearOldAppointments");
if (clearOldAppointmentsBtn) {
  clearOldAppointmentsBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to delete all past appointments?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/appointments/cleanup`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      alert(data.message || "Old appointments deleted.");
      loadAppointments(); 
    } catch (err) {
      alert("Error deleting old appointments: " + err.message);
    }
  });

  const clearOldOrdersBtn = document.getElementById("clearOldOrders");
  if (clearOldOrdersBtn) {
  clearOldOrdersBtn.addEventListener("click", async () => {
    if (!confirm("Delete all completed/cancelled orders?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/orders/cleanup`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      alert(data.message || "Orders cleaned up.");
      loadOrders();
    } catch (err) {
      alert("Error cleaning orders: " + err.message);
    }
  });
}
}

//---- logout ----
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");  

    window.location.href = "../cat place.html";
  });
}
});

