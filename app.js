// BEGIN BROWSER CONFIG
// Source konfigurasi Supabase untuk browser. Workflow Pages menyematkannya ke
// blok konfigurasi dalam frontend/app.js. Gunakan hanya publishable/anon key.
// Logic UI berada di frontend/app.js; skema dan migrasi SQL berada di database/.

const APP_CONFIG = {
	name: 'LAVÉ Dress Rental & Finance System',
	version: null
};

const SUPABASE_URL = 'https://bfezhiolyrktsjlexspl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_udTbqblnFFBgn1-Kc4q4AQ_WTPGZUHO';

const SUPABASE_CONFIG = {
	service: 'Supabase',
	databaseEngine: 'PostgreSQL',
	url: SUPABASE_URL,
	publicKey: SUPABASE_ANON_KEY,
	browserKeyType: 'publishable/anon',
	auth: {
		provider: 'Supabase Auth',
		integratedInSql: true,
		frontendLoginEnabled: false
	},
	rls: {
		policiesDefinedByMigrations: true,
		disabledByPublicAccessMigration: '36_public_access.sql'
	}
};

const DATABASE_CONFIG = {
	schema: 'public',
	directory: './database',
	contains: [
		'schema',
		'seed',
		'functions',
		'triggers',
		'views',
		'RPC',
		'security'
	]
};

const supabaseClient = window.supabase.createClient(
	SUPABASE_URL,
	SUPABASE_ANON_KEY
);

const moneyFormat = new Intl.NumberFormat('id-ID', {
	style: 'currency',
	currency: 'IDR',
	maximumFractionDigits: 0
});

const safeNumber = value => Number(value || 0);

window.lave = {
	supabase: supabaseClient,
	profile: {profile_role: 'admin'},
	hasRole: () => true,

	handleSupabaseError: (error, context = {}) => {
		console.error('Supabase error', {
			...context,
			code: error?.code,
			message: error?.message,
			details: error?.details,
			hint: error?.hint
		});
		return error
	},

	currency: value => moneyFormat.format(safeNumber(value)),

	escape: value =>
		String(value ?? '')
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#039;'),

	toast: (message, type = 'success') => {
		const element = document.getElementById('toast');
		if (!element) return alert(message);
		element.textContent = message;
		element.className = 'toast show ' + type;
		setTimeout(() => element.className = 'toast', 2500)
	},

	formatDate: value => {
		if (!value) return '-';
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? String(value)
			: date.toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			})
	},

	pad: (value, digits = 2) => String(value).padStart(digits, '0'),

	nextCode: async type => {
		const {data, error} = await supabaseClient.rpc('next_business_code', {
			p_type: type
		});
		if (error) throw error;
		return data
	},

	rentalCode: async () => window.lave.nextCode('rental'),
	paymentCode: async () => window.lave.nextCode('payment')
};
// END BROWSER CONFIG


// Bundled frontend modules
const frontendModules = {
  "dress-master-api.js": function () {
    (function () {
      const supabase = window.lave.supabase;
      const FAIL_MESSAGE = 'Data dress gagal diperbarui. Silakan periksa kembali data atau hak akses.';
    
      function currentRole() {
        return String(
          window.lave.profile?.profile_role || window.lave.profile?.role || ''
        ).toLowerCase();
      }
    
      function canEditDressMaster() {
        return ['admin', 'staff'].includes(currentRole());
      }
    
      function rlsDenied(error) {
        const text = `${error?.message || ''} ${error?.code || ''} ${error?.details || ''}`.toLowerCase();
        return error?.code === '42501' ||
          text.includes('row-level security') ||
          text.includes('permission denied');
      }
    
      function buildDressMasterPayload(input) {
        const name = String(input?.name || '').trim();
        if (!name) return { error: 'Nama dress wajib diisi.' };
    
        const categoryId = Number(input?.category_id);
        if (!Number.isInteger(categoryId) || categoryId <= 0) {
          return { error: 'Kategori wajib diisi.' };
        }
    
        const purchaseRaw = input?.purchase_price;
        const rentalRaw = input?.rental_price;
    
        if (
          purchaseRaw === '' ||
          purchaseRaw == null ||
          rentalRaw === '' ||
          rentalRaw == null
        ) {
          return { error: 'Tolong masukkan harga yang valid.' };
        }
    
        const purchase_price = Number(purchaseRaw);
        const rental_price = Number(rentalRaw);
    
        if (!Number.isFinite(purchase_price) || !Number.isFinite(rental_price)) {
          return { error: 'Tolong masukkan harga yang valid.' };
        }
    
        if (purchase_price < 0 || rental_price < 0) {
          return { error: 'Harga tidak boleh negatif.' };
        }
    
        const supplierRaw = input?.supplier_id;
        let supplier_id = null;
    
        if (supplierRaw !== '' && supplierRaw != null) {
          supplier_id = Number(supplierRaw);
          if (!Number.isInteger(supplier_id) || supplier_id <= 0) {
            return { error: 'Supplier tidak valid.' };
          }
        }
    
        return {
          payload: {
            name,
            category_id: categoryId,
            purchase_price,
            rental_price,
            supplier_id,
            condition: String(input?.condition || 'Good'),
            description: String(input?.description || '').trim() || null
          }
        };
      }
    
      async function uploadDressPhoto(file, existingUrl) {
        if (!file) {
          return { photo_url: existingUrl || null, uploadedPath: null };
        }
    
        if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
          return { error: 'Pilih file gambar berukuran maksimal 5 MB.' };
        }
    
        const extension =
          file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    
        const path = `public/${crypto.randomUUID()}.${extension}`;
        const storage = supabase.storage.from('dress-photos');
    
        const upload = await storage.upload(path, file, {
          contentType: file.type,
          upsert: false
        });
    
        if (upload.error) return { error: upload.error.message };
    
        return {
          photo_url: storage.getPublicUrl(upload.data.path).data.publicUrl,
          uploadedPath: upload.data.path
        };
      }
    
      async function updateDress(dressId, fields, photoFile, extra = {}) {
        const id = Number(dressId);
    
        if (!Number.isInteger(id) || id <= 0) {
          const error = {
            message: 'Dress tidak ditemukan.',
            code: 'DRESS_ID_MISSING'
          };
          console.error('Update dress error:', error);
          return { error };
        }
    
        const built = buildDressMasterPayload(fields);
    
        if (built.error) {
          const error = {
            message: built.error,
            code: 'VALIDATION'
          };
          console.error('Update dress error:', error);
          return { error };
        }
    
        const existing = await supabase
          .from('dresses')
          .select('id, photo_url, dress_code')
          .eq('id', id)
          .maybeSingle();
    
        if (existing.error) {
          console.error('Update dress error:', existing.error);
          return { error: existing.error };
        }
    
        if (!existing.data) {
          const error = {
            message: 'Dress tidak ditemukan.',
            code: 'DRESS_NOT_FOUND'
          };
          console.error('Update dress error:', error);
          return { error };
        }
    
        const photo = await uploadDressPhoto(photoFile, existing.data.photo_url);
    
        if (photo.error) {
          const error = {
            message: photo.error,
            code: 'PHOTO_UPLOAD'
          };
          console.error('Update dress error:', error);
          return { error };
        }
    
        const payload = {
          ...built.payload,
          photo_url: photo.photo_url
        };
    
        if (Object.prototype.hasOwnProperty.call(extra, 'is_active')) {
          payload.is_active = extra.is_active !== false;
          payload.status = payload.is_active ? 'Available' : 'Not Available';
        }
    
        delete payload.id;
        delete payload.dress_code;
        delete payload.created_at;
        delete payload.updated_at;
    
        const result = await supabase
          .from('dresses')
          .update(payload)
          .eq('id', id)
          .select('id')
          .maybeSingle();
    
        if (result.error) {
          if (photo.uploadedPath) {
            await supabase.storage.from('dress-photos').remove([photo.uploadedPath]);
          }
    
          console.error('Update dress error:', result.error);
    
          const message = rlsDenied(result.error)
            ? FAIL_MESSAGE
            : (result.error.message || FAIL_MESSAGE);
    
          return {
            error: {
              ...result.error,
              message
            }
          };
        }
    
        if (!result.data) {
          if (photo.uploadedPath) {
            await supabase.storage.from('dress-photos').remove([photo.uploadedPath]);
          }
    
          const error = {
            message: FAIL_MESSAGE,
            code: 'NO_ROW_UPDATED'
          };
    
          console.error('Update dress error:', error);
          return { error };
        }
    
        return { data: result.data };
      }
    
      window.lave.buildDressMasterPayload = buildDressMasterPayload;
      window.lave.uploadDressPhoto = uploadDressPhoto;
      window.lave.updateDress = updateDress;
      window.lave.canEditDressMaster = canEditDressMaster;
    }());
  },
  "integrated-flow.js": function () {
    (function () {
      const page = document.body && document.body.dataset ? document.body.dataset.page : '';
      const la = window.lave || {};
      const supabase = la.supabase;
      if (!supabase) return;
    
      function money(v) {
        return la.currency ? la.currency(v) : 'Rp' + Number(v || 0).toLocaleString('id-ID');
      }
    
      function statusBadge(v) {
        const label = String(v || '-');
        const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return '<span class="badge status-' + key + '">' + la.escape(label) + '</span>';
      }
    
      function getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
      }
    
      function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
      }

      function openWhatsApp(phone, message) {
        let digits = String(phone || '').replace(/\D/g, '');
        if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
        else if (digits.startsWith('8')) digits = `62${digits}`;
        if (!digits) {
          la.toast('Nomor WhatsApp customer belum tersedia.', 'error');
          return;
        }
        window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
      }

      function showWhatsAppHub(rental) {
        const customer = rental.customers || {};
        const total = Number(rental.total_rental ?? rental.total_amount ?? 0);
        const paid = (rental.payments || []).reduce((sum, payment) =>
          sum + (payment.payment_type === 'REFUND'
            ? -Number(payment.amount || 0)
            : ['DP', 'PELUNASAN'].includes(payment.payment_type)
              ? Number(payment.amount || 0)
              : 0), 0);
        const remaining = Math.max(total - paid, 0);
        const templates = {
          payment: `Halo ${customer.name || 'Customer'}, kami mengingatkan bahwa pembayaran rental ${rental.rental_code} masih memiliki sisa ${money(remaining)}. Mohon konfirmasi pelunasannya. Terima kasih.`,
          return: `Halo ${customer.name || 'Customer'}, kami mengingatkan jadwal pengembalian rental ${rental.rental_code} pada ${la.formatDate(rental.return_due_date)}. Mohon mengembalikan dress sesuai jadwal. Terima kasih.`,
          dp: `Halo ${customer.name || 'Customer'}, kami mengonfirmasi penerimaan DP untuk rental ${rental.rental_code}. Total rental ${money(total)} dan sisa pembayaran ${money(remaining)}. Terima kasih.`,
          pickup: `Halo ${customer.name || 'Customer'}, dress untuk rental ${rental.rental_code} siap diambil. Jadwal pengembalian ${la.formatDate(rental.return_due_date)}. Terima kasih.`,
          other: `Halo ${customer.name || 'Customer'}, terkait rental ${rental.rental_code}, `
        };
        let modal = document.getElementById('whatsAppHubModal');
        if (!modal) {
          document.body.insertAdjacentHTML('beforeend', `
            <div class="modal" id="whatsAppHubModal">
              <div class="modal-box">
                <div class="modal-head"><h3>Hub WhatsApp</h3><button class="close" type="button" data-wa-close>×</button></div>
                <p id="whatsAppHubCustomer"></p>
                <div class="field"><label>Template Pesan</label><select id="whatsAppHubTemplate">
                  <option value="payment">Pengingat Pelunasan</option>
                  <option value="return">Pengingat Pengembalian</option>
                  <option value="dp">Konfirmasi DP</option>
                  <option value="pickup">Informasi Pengambilan</option>
                  <option value="other">Pesan Lainnya</option>
                </select></div>
                <div class="field"><label>Pesan (dapat diedit)</label><textarea id="whatsAppHubMessage" rows="5"></textarea></div>
                <div class="form-actions"><button class="btn btn-light" type="button" data-wa-close>Batal</button><button class="btn btn-primary" type="button" id="whatsAppHubSend">Buka WhatsApp</button></div>
              </div>
            </div>
          `);
          modal = document.getElementById('whatsAppHubModal');
          modal.querySelectorAll('[data-wa-close]').forEach(button =>
            button.addEventListener('click', () => closeModal('whatsAppHubModal'))
          );
          document.getElementById('whatsAppHubTemplate').addEventListener('change', event => {
            document.getElementById('whatsAppHubMessage').value =
              modal.dataset.templates ? JSON.parse(modal.dataset.templates)[event.target.value] || '' : '';
          });
          document.getElementById('whatsAppHubSend').addEventListener('click', () => {
            openWhatsApp(modal.dataset.phone, document.getElementById('whatsAppHubMessage').value.trim());
          });
        }

        modal.dataset.phone = customer.phone || '';
        modal.dataset.templates = JSON.stringify(templates);
        document.getElementById('whatsAppHubCustomer').textContent =
          `${customer.name || 'Customer'} · ${customer.phone || 'Nomor telepon belum tersedia'} · ${rental.rental_code}`;
        const templateSelect = document.getElementById('whatsAppHubTemplate');
        templateSelect.value = remaining > 0 ? 'payment' : 'return';
        document.getElementById('whatsAppHubMessage').value = templates[templateSelect.value];
        openModal('whatsAppHubModal');
      }
    
      async function loadCustomers() {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('id', { ascending: false });
    
        if (error) throw error;
        return data || [];
      }
    
      async function loadDresses() {
        const { data, error } = await supabase
          .from('dresses')
          .select('*, dress_categories(category_name)')
          .order('dress_code');
    
        if (error) throw error;
        return data || [];
      }
    
      async function loadRentalOptions() {
        const { data, error } = await supabase
          .from('rentals')
          .select('*, customers(name)')
          .order('id', { ascending: false });
    
        if (error) throw error;
        return data || [];
      }
    
      async function loadSuppliers() {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .order('id', { ascending: false });
    
        if (error) throw error;
        return data || [];
      }
    
      async function loadCategories() {
        const { data, error } = await supabase
          .from('dress_categories')
          .select('*')
          .order('category_name');
    
        if (error) throw error;
        return data || [];
      }
    
      async function nextCode(type) {
        return la.nextCode(type);
      }

      async function nextPurchaseCode() {
        const { data, error } = await supabase.rpc('next_purchase_code_preview');
        if (error?.code === 'PGRST202') {
          throw new Error(
            'Database belum menerapkan Migration 40 untuk mengurutkan nomor pembelian berdasarkan transaksi tersimpan.'
          );
        }
        if (error) throw error;
        if (!data) throw new Error('Nomor pembelian berikutnya tidak tersedia.');
        return data;
      }
    
      async function ensureCustomerFromForm(customerName, phone = '', email = '', address = '') {
        const name = String(customerName || '').trim();
        if (!name) return null;
    
        const { data: existing } = await supabase
          .from('customers')
          .select('*')
          .ilike('name', name)
          .limit(1);
    
        if (existing && existing.length) return existing[0];
    
        const payload = {
          customer_code: await nextCode('customer'),
          name,
          phone: phone || null,
          email: email || null,
          address: address || null
        };
    
        const { data, error } = await supabase
          .from('customers')
          .insert(payload)
          .select()
          .single();
    
        if (error) throw error;
        return data;
      }
    
      async function ensureSupplierFromForm(supplierName, phone = '', email = '', address = '', notes = '') {
        const name = String(supplierName || '').trim();
        if (!name) return null;
    
        const { data: existing } = await supabase
          .from('suppliers')
          .select('*')
          .ilike('name', name)
          .limit(1);
    
        if (existing && existing.length) return existing[0];
    
        const payload = {
          supplier_code: await nextCode('supplier'),
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
          notes: notes || null
        };
    
        const { data, error } = await supabase
          .from('suppliers')
          .insert(payload)
          .select()
          .single();
    
        if (error) throw error;
        return data;
      }
    
      function computeStatus(total, paid) {
        const remaining = Number(total || 0) - Number(paid || 0);
        if (remaining <= 0) return 'Lunas';
        if (paid > 0) return 'Sebagian Dibayar';
        return 'Belum Dibayar';
      }
    
      async function initRentalPage() {
        const form = document.getElementById('form');
        if (!form) return;
    
        form.innerHTML = `
          <div class="form-grid">
            <div class="field">
              <label>Nomor Penyewaan</label>
              <input id="rental_code" required>
            </div>
            <div class="field">
              <label>Customer</label>
              <select id="customer_id"></select>
            </div>
            <div class="field">
              <label>Nama Customer Baru (jika belum terdaftar)</label>
              <input id="customer_name" placeholder="Isi jika customer belum ada">
            </div>
            <div class="field">
              <label>No. HP</label>
              <input id="customer_phone">
            </div>
            <div class="field">
              <label>Email</label>
              <input id="customer_email" type="email">
            </div>
            <div class="field">
              <label>Alamat</label>
              <input id="customer_address">
            </div>
            <div class="field">
              <label>Model Dress</label>
              <select id="dress_code" required>
                <option value="">Pilih model dress</option>
              </select>
            </div>
            <div class="field">
              <label>Ukuran Tersedia</label>
              <select id="dress_variant_id" required>
                <option value="">Pilih model terlebih dahulu</option>
              </select>
            </div>
            <div class="field">
              <label>Unit Fisik Tersedia</label>
              <select id="dress_unit_id" required disabled>
                <option value="">Pilih ukuran dan warna terlebih dahulu</option>
              </select>
            </div>
            <div class="field">
              <label>Nama Dress</label>
              <input id="dress_name" readonly>
            </div>
            <div class="field">
              <label>Kategori</label>
              <input id="dress_category" readonly>
            </div>
            <div class="field">
              <label>Ukuran</label>
              <input id="dress_size" readonly>
            </div>
            <div class="field">
              <label>Warna</label>
              <input id="dress_color" readonly>
            </div>
            <div class="field">
              <label>Harga Sewa</label>
              <input id="rental_price" type="number" readonly>
            </div>
            <div class="field">
              <label>Tanggal Mulai Sewa</label>
              <input id="rental_date" type="date" required>
            </div>
            <div class="field">
              <label>Tanggal Kembali</label>
              <input id="return_due_date" type="date" required>
            </div>
            <div class="field">
              <label>Deposit/Jaminan Diterima</label>
              <input id="deposit_amount" type="number" value="0" min="0">
            </div>
            <div class="field">
              <label>Total Sewa</label>
              <input id="total_amount" type="number" readonly>
            </div>
            <div class="field">
              <label>Sisa Sewa</label>
              <input id="remaining_rent" type="number" readonly>
            </div>
            <div class="field">
              <label>Total Dibayar (DP + Deposit)</label>
              <input id="total_received_amount" type="number" readonly>
            </div>
            <div class="field">
              <label>Status Pembayaran Sewa</label>
              <input id="initial_payment_status" readonly>
            </div>
            <div class="field">
              <label>Status Penyewaan</label>
              <select id="rental_status">
                <option value="Booked">Booked</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div class="field">
              <label>DP / Pembayaran Awal Sewa</label>
              <input id="initial_payment" type="number" min="0" value="0">
            </div>
            <div class="field">
              <label>Metode Pembayaran</label>
              <select id="initial_payment_method">
                <option value="Cash">Cash</option>
                <option value="Transfer">Transfer</option>
                <option value="E-Wallet">E-Wallet</option>
              </select>
            </div>
            <div class="field">
              <label>Tipe Pembayaran</label>
              <select id="initial_payment_type">
                <option value="DP">DP</option>
                <option value="PELUNASAN">Pelunasan</option>
              </select>
            </div>
            <div class="field">
              <label>Tanggal Pembayaran</label>
              <input id="initial_payment_date" type="date">
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-light" onclick="closeModal('modal')">Batal</button>
            <button type="submit" class="btn btn-primary">Simpan</button>
          </div>
        `;
    
        const tableBody = document.getElementById('tbody');
        const search = document.getElementById('search');
        const modalTitle = document.querySelector('.modal-head h3');
        if (modalTitle) modalTitle.textContent = 'Rental Baru';
    
        const tableHeader = tableBody.closest('table')?.querySelector('thead tr');
        if (tableHeader) {
          tableHeader.innerHTML = '<th>Kode</th><th>Customer</th><th>Tanggal</th><th>Jatuh Tempo</th><th>Total</th><th>Terbayar</th><th>Sisa</th><th>Status Rental</th><th>Status Pembayaran</th><th>Aksi</th>';
        }
    
        const customersSelect = document.getElementById('customer_id');
        const rentalCodeInput = document.getElementById('rental_code');
        const dressCodeInput = document.getElementById('dress_code');
        const variantSelect = document.getElementById('dress_variant_id');
        const unitSelect = document.getElementById('dress_unit_id');
        let unitLoadRequest = 0;
        const rentalPriceInput = document.getElementById('rental_price');
        const totalAmountInput = document.getElementById('total_amount');
        const rentalDateInput = document.getElementById('rental_date');
        const returnDueInput = document.getElementById('return_due_date');
    
        const dressMap = new Map();
        const customers = await loadCustomers();
    
        customersSelect.innerHTML =
          '<option value="">Pilih Customer</option>' +
          customers
            .map(c => `<option value="${c.id}">${c.customer_code} - ${c.name}</option>`)
            .join('');
    
        customersSelect.addEventListener('change', () => {
          const customer = customers.find(
            item => Number(item.id) === Number(customersSelect.value)
          );
    
          setValue('customer_name', customer ? customer.name : '');
          setValue('customer_phone', customer ? customer.phone : '');
          setValue('customer_email', customer ? customer.email : '');
          setValue('customer_address', customer ? customer.address : '');
        });
    
        const [dressRows, variantResult] = await Promise.all([
          loadDresses(),
          supabase
            .from('dress_variants')
            .select('*')
            .order('normalized_size')
        ]);
    
        if (variantResult.error) throw variantResult.error;
    
        const dresses = dressRows.filter(dress => dress.is_active !== false);
        let variants = variantResult.data || [];
    
        dresses.forEach(dress => {
          dressMap.set(String(dress.id), dress);
    
          const option = document.createElement('option');
          option.value = String(dress.id);
          option.textContent = `${dress.dress_code} - ${dress.name}`;
          dressCodeInput.appendChild(option);
        });
    
        const now = new Date();
        const defaultDate = new Date(now.getTime() + 86400000)
          .toISOString()
          .slice(0, 10);
    
        setValue('rental_code', await nextCode('rental'));
        setValue('rental_date', new Date().toISOString().slice(0, 10));
        setValue('return_due_date', defaultDate);
        setValue('initial_payment_date', new Date().toISOString().slice(0, 10));
        updateRentalSummary();
    
        dressCodeInput.addEventListener('change', () => {
          unitLoadRequest += 1;
          const dress = dressMap.get(dressCodeInput.value);
    
          if (!dress) {
            variantSelect.innerHTML =
              '<option value="">Pilih model terlebih dahulu</option>';
            unitSelect.innerHTML =
              '<option value="">Pilih ukuran dan warna terlebih dahulu</option>';
            unitSelect.disabled = true;
    
            setValue('dress_name', '');
            setValue('dress_category', '');
            setValue('dress_size', '');
            setValue('dress_color', '');
            setValue('rental_price', '');
            setValue('total_amount', '');
            return;
          }
    
          const dressVariants = variants.filter(
            variant => Number(variant.dress_id) === Number(dress.id)
          );
    
          variantSelect.innerHTML =
            '<option value="">Pilih ukuran dan warna</option>' +
            dressVariants
              .map(variant => {
                const unverified =
                  String(variant.color || '').toUpperCase() === 'UNVERIFIED';
    
                const available =
                  Number(variant.available_quantity || 0) > 0 && !unverified;
    
                return `<option value="${variant.id}" ${available ? '' : 'disabled'}>${la.escape(variant.size)} / ${la.escape(variant.color)} — ${available ? `Tersedia ${variant.available_quantity}` : unverified ? 'Perlu stocktake' : 'Tidak tersedia'}</option>`;
              })
              .join('');
    
          setValue('dress_name', dress.name);
          setValue(
            'dress_category',
            dress.dress_categories ? dress.dress_categories.category_name : ''
          );
          setValue('dress_color', dress.color || '');
    
          unitSelect.innerHTML =
            '<option value="">Pilih ukuran dan warna terlebih dahulu</option>';
          unitSelect.disabled = true;
    
          setValue('dress_size', '');
          setValue('rental_price', '');
          setValue('total_amount', '');
          updateRentalSummary();
        });
    
            variantSelect.addEventListener('change', async () => {
          const requestId = ++unitLoadRequest;
          const variant = variants.find(
            item => Number(item.id) === Number(variantSelect.value)
          );
          const dress = dressMap.get(dressCodeInput.value);
    
          if (!variant || !dress) {
            unitSelect.innerHTML =
              '<option value="">Pilih ukuran dan warna terlebih dahulu</option>';
            unitSelect.disabled = true;
            setValue('dress_size', '');
            setValue('rental_price', '');
            setValue('total_amount', '');
            return;
          }
    
          setValue('dress_size', variant.size);
          setValue('dress_color', variant.color || '');
          setValue('rental_price', dress.rental_price || 0);
          setValue('total_amount', Number(dress.rental_price || 0));
          updateRentalSummary();
    
          unitSelect.disabled = true;
          unitSelect.innerHTML =
            '<option value="">Memuat unit tersedia...</option>';
    
          const unitResult = await supabase
            .from('dress_units')
            .select('id,unit_code,status')
            .eq('variant_id', variant.id)
            .eq('status', 'Available')
            .order('unit_code');
    
          if (requestId !== unitLoadRequest) return;
    
          if (unitResult.error) {
            unitSelect.innerHTML =
              '<option value="">Unit tidak dapat dimuat</option>';
            la.toast(unitResult.error.message, 'error');
            return;
          }
    
          unitSelect.innerHTML =
            '<option value="">Pilih unit fisik</option>' +
            (unitResult.data || [])
              .map(
                unit =>
                  `<option value="${unit.id}">${la.escape(unit.unit_code)}</option>`
              )
              .join('');
    
          unitSelect.disabled = !(unitResult.data || []).length;
    
          if (!(unitResult.data || []).length) {
            unitSelect.innerHTML =
              '<option value="">Tidak ada unit Available</option>';
          }
        });
    
        function updateRentalSummary() {
          const total = Number(getValue('rental_price') || 0);
          const downPayment = Number(getValue('initial_payment') || 0);
          const deposit = Number(getValue('deposit_amount') || 0);
          setValue('remaining_rent', Math.max(total - downPayment, 0));
          setValue('total_received_amount', downPayment + deposit);
          setValue('initial_payment_status', computeStatus(total, downPayment));
        }
    
        ['initial_payment', 'deposit_amount'].forEach(id =>
          document
            .getElementById(id)
            .addEventListener('input', updateRentalSummary)
        );
    
        async function renderList() {
          const { data, error } = await supabase
            .from('rentals')
            .select('*, customers(name,phone), payments(amount,payment_type)')
            .order('id', { ascending: false });
    
          if (error) {
            la.toast(error.message, 'error');
            return;
          }
    
          const q = (search ? search.value : '').toLowerCase();
    
          const items = (data || []).filter(
            r =>
              (r.rental_code || '').toLowerCase().includes(q) ||
              (r.customers && r.customers.name || '').toLowerCase().includes(q)
          );
    
          tableBody.innerHTML = items.length
            ? items
                .map(r => {
                  const paid = (r.payments || []).reduce(
                    (sum, payment) =>
                      sum +
                      (payment.payment_type === 'REFUND'
                        ? -Number(payment.amount || 0)
                        : ['DP', 'PELUNASAN'].includes(payment.payment_type)
                          ? Number(payment.amount || 0)
                          : 0),
                    0
                  );
    
                  const total = Number(r.total_rental ?? r.total_amount ?? 0);
                  const remaining = Math.max(total - paid, 0);
                  const rentalStatus =
                    r.rental_status ||
                    (r.status === 'Cancelled' ? 'Cancelled' : 'Booked');
                  const paymentStatus =
                    r.payment_status || computeStatus(total, paid);
    
                  return `<tr>
              <td>${la.escape(r.rental_code)}</td>
              <td>${la.escape(r.customers ? r.customers.name : '-')}</td>
              <td>${la.formatDate(r.rental_date)}</td>
              <td>${la.formatDate(r.return_due_date)}</td>
              <td>${money(total)}</td>
              <td>${money(paid)}</td>
              <td>${money(remaining)}</td>
              <td>${statusBadge(rentalStatus)}</td>
              <td>${statusBadge(paymentStatus)}</td>
              <td><button type="button" class="btn btn-light rental-detail" data-id="${r.id}">Detail</button>${remaining > 0 && rentalStatus !== 'Cancelled' ? ` <button type="button" class="btn btn-light rental-pay" data-id="${r.id}" data-balance="${remaining}">Bayar Sisa</button>` : ''} <button type="button" class="btn btn-light rental-whatsapp" data-id="${r.id}">Hub WA</button>${!['Cancelled', 'Completed'].includes(rentalStatus) ? ` <button type="button" class="btn btn-light rental-cancel" data-id="${r.id}">Batalkan</button>` : ''} <button type="button" class="btn btn-light rental-print" data-id="${r.id}">Cetak</button></td>
            </tr>`;
                })
                .join('')
            : '<tr><td colspan="10" class="empty">Belum ada data rental.</td></tr>';
    
          tableBody
            .querySelectorAll('.rental-detail')
            .forEach(button =>
              button.addEventListener('click', () =>
                showRentalDetail(Number(button.dataset.id))
              )
            );
    
          tableBody
            .querySelectorAll('.rental-pay')
            .forEach(button =>
              button.addEventListener('click', () =>
                payRentalBalance(
                  Number(button.dataset.id),
                  Number(button.dataset.balance)
                )
              )
            );
    
          tableBody
            .querySelectorAll('.rental-cancel')
            .forEach(button =>
              button.addEventListener('click', () =>
                cancelRental(Number(button.dataset.id))
              )
            );
    
          tableBody
            .querySelectorAll('.rental-print')
            .forEach(button =>
              button.addEventListener('click', () =>
                printRentalInvoice(Number(button.dataset.id))
              )
            );

          tableBody.querySelectorAll('.rental-whatsapp').forEach(button => {
            button.addEventListener('click', () => {
              const rental = (data || []).find(item => Number(item.id) === Number(button.dataset.id));
              if (rental) showWhatsAppHub(rental);
            });
          });
        }
    
        async function getRentalRecord(rentalId) {
          const result = await supabase
            .from('rentals')
            .select(
              '*, customers(*), payments(*), rental_details(*, dresses(*, dress_categories(category_name)), dress_variants(size,color), dress_units(unit_code,status,condition))'
            )
            .eq('id', rentalId)
            .single();
    
          if (result.error) throw result.error;
          return result.data;
        }
    
        function paymentTotals(rental) {
          const paid = (rental.payments || []).reduce(
            (sum, payment) =>
              sum +
              (payment.payment_type === 'REFUND'
                ? -Number(payment.amount || 0)
                : ['DP', 'PELUNASAN'].includes(payment.payment_type)
                  ? Number(payment.amount || 0)
                  : 0),
            0
          );
    
          const total = Number(rental.total_rental ?? rental.total_amount ?? 0);
    
          return {
            total,
            paid,
            remaining: Math.max(total - paid, 0)
          };
        }
    
        async function showRentalDetail(rentalId) {
          try {
            const rental = await getRentalRecord(rentalId);
            const totals = paymentTotals(rental);
            const detail = (rental.rental_details || [])[0] || {};
            const dress = detail.dresses || {};
            let modal = document.getElementById('rentalDetailModal');
    
            if (!modal) {
              document.body.insertAdjacentHTML(
                'beforeend',
                '<div class="modal" id="rentalDetailModal"><div class="modal-box"><div class="modal-head"><h3>Detail Rental</h3><button class="close" onclick="closeModal(\'rentalDetailModal\')">×</button></div><div id="rentalDetailContent"></div></div></div>'
              );
              modal = document.getElementById('rentalDetailModal');
            }
    
            document.getElementById('rentalDetailContent').innerHTML = `
              <div class="form-grid">
                <div class="field"><label>Kode Rental</label><input readonly value="${la.escape(rental.rental_code)}"></div>
                <div class="field"><label>Customer</label><input readonly value="${la.escape(rental.customers ? rental.customers.name : '-')}\"></div>
                <div class="field"><label>Dress</label><input readonly value="${la.escape(dress.dress_code || '-')} - ${la.escape(dress.name || '')}"></div>
                <div class="field"><label>Ukuran</label><input readonly value="${la.escape(detail.dress_variants?.size || '-')}"></div>
                <div class="field"><label>Unit Fisik</label><input readonly value="${la.escape(detail.dress_units?.unit_code || '-')} / ${la.escape(detail.dress_units?.status || '-')}"></div>
                <div class="field"><label>Warna</label><input readonly value="${la.escape(detail.dress_variants?.color || '-')}"></div>
                <div class="field"><label>Tanggal Rental</label><input readonly value="${la.escape(rental.rental_date)}"></div>
                <div class="field"><label>Tanggal Pengembalian</label><input readonly value="${la.escape(rental.return_due_date)}"></div>
                <div class="field"><label>Total Rental</label><input readonly value="${money(totals.total)}"></div>
                <div class="field"><label>Deposit Diterima</label><input readonly value="${money(rental.deposit_received_amount)}"></div>
                <div class="field"><label>Status Rental</label><input readonly value="${la.escape(rental.rental_status || 'Booked')}"></div>
                <div class="field"><label>Status Pembayaran</label><input readonly value="${la.escape(rental.payment_status || computeStatus(totals.total, totals.paid))}"></div>
                <div class="field"><label>Total Dibayar</label><input readonly value="${money(totals.paid)}"></div>
                <div class="field"><label>Sisa Pembayaran</label><input readonly value="${money(totals.remaining)}"></div>
              </div>
              <h4>Riwayat Pembayaran</h4>
              <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Tipe</th><th>Jumlah</th><th>Metode</th><th>Nota</th></tr></thead><tbody>${(rental.payments || []).length ? rental.payments.map(payment => `<tr><td>${la.formatDate(payment.payment_date)}</td><td>${la.escape(payment.payment_type || '-')}</td><td>${money(payment.amount)}</td><td>${la.escape(payment.payment_method || '-')}</td><td><button type="button" class="btn btn-light rental-payment-receipt" data-id="${payment.id}">Cetak Nota</button></td></tr>`).join('') : '<tr><td colspan="5">Belum ada pembayaran.</td></tr>'}</tbody></table></div>
              <div class="form-actions"><button type="button" class="btn btn-light" id="detailWhatsAppButton">Hub WA</button><button type="button" class="btn btn-light" id="detailPayButton" ${totals.remaining <= 0 || rental.rental_status === 'Cancelled' ? 'disabled' : ''}>+ Bayar Sisa</button><button type="button" class="btn btn-light" id="detailCancelButton" ${['Cancelled', 'Completed'].includes(rental.rental_status || '') ? 'disabled' : ''}>Batalkan Rental</button><button type="button" class="btn btn-light" id="detailEditButton" ${['Cancelled', 'Completed'].includes(rental.rental_status || '') ? 'disabled' : ''}>Edit Rental</button><button type="button" class="btn btn-light" id="detailPrintButton">Cetak Invoice</button></div>
            `;
    
            document
              .getElementById('detailPayButton')
              .addEventListener('click', () =>
                payRentalBalance(rental.id, totals.remaining)
              );
    
            document
              .getElementById('detailCancelButton')
              .addEventListener('click', () => cancelRental(rental.id));
    
            document
              .getElementById('detailEditButton')
              .addEventListener('click', () => editRental(rental));
    
            document
              .getElementById('detailPrintButton')
              .addEventListener('click', () => printRentalInvoice(rental.id));
            document.getElementById('detailWhatsAppButton')
              .addEventListener('click', () => showWhatsAppHub(rental));

            const chronologicalPayments = (rental.payments || []).slice().sort((first, second) =>
              String(first.payment_date || '').localeCompare(String(second.payment_date || '')) ||
              Number(first.id || 0) - Number(second.id || 0)
            );
            let historicalPaid = 0;
            const historicalTotals = new Map();
            chronologicalPayments.forEach(payment => {
              historicalPaid += payment.payment_type === 'REFUND'
                ? -Number(payment.amount || 0)
                : ['DP', 'PELUNASAN'].includes(payment.payment_type)
                  ? Number(payment.amount || 0)
                  : 0;
              historicalTotals.set(String(payment.id), historicalPaid);
            });
            document.querySelectorAll('.rental-payment-receipt').forEach(button => {
              button.addEventListener('click', () => {
                const payment = chronologicalPayments.find(item => String(item.id) === button.dataset.id);
                if (!payment) return;
                const popup = window.open('', '_blank');
                if (!popup) {
                  la.toast('Popup bukti pembayaran diblokir browser.', 'error');
                  return;
                }
                const totalPaidAtPayment = historicalTotals.get(String(payment.id)) || 0;
                printRentalPaymentReceipt({
                  rental,
                  payment,
                  amount: payment.payment_type === 'REFUND' ? -Number(payment.amount || 0) : Number(payment.amount || 0),
                  totalPaid: totalPaidAtPayment,
                  remaining: Math.max(totals.total - totalPaidAtPayment, 0),
                  rentalTotal: totals.total,
                  popupWindow: popup
                });
              });
            });
    
            openModal('rentalDetailModal');
          } catch (error) {
            la.toast(
              error.message || 'Detail rental gagal dimuat.',
              'error'
            );
          }
        }
    
        async function payRentalBalance(rentalId, balance) {
          const rental = await getRentalRecord(rentalId);
          const totals = paymentTotals(rental);
          let modal = document.getElementById('rentalPaymentModal');
    
          if (!modal) {
            document.body.insertAdjacentHTML(
              'beforeend',
              '<div class="modal" id="rentalPaymentModal"><div class="modal-box"><div class="modal-head"><h3>Pembayaran Rental</h3><button class="close" onclick="closeModal(\'rentalPaymentModal\')">×</button></div><form id="rentalPaymentForm"><div id="rentalPaymentSummary"></div><div class="form-grid"><div class="field"><label>Nominal Pembayaran</label><input id="rental_payment_amount" type="number" min="1" required></div><div class="field"><label>Metode</label><select id="rental_payment_method"><option>Cash</option><option>Transfer Bank</option><option>E-Wallet</option><option>QRIS</option><option>Lainnya</option></select></div><div class="field"><label>Tanggal</label><input id="rental_payment_date" type="date" required></div><div class="field"><label>Nomor Referensi</label><input id="rental_payment_reference"></div><div class="field"><label>Catatan</label><input id="rental_payment_notes"></div></div><div id="rentalPaymentPreview" class="card" style="padding:12px;margin-top:12px"></div><div class="form-actions"><button type="button" class="btn btn-light" onclick="closeModal(\'rentalPaymentModal\')">Batal</button><button type="submit" class="btn btn-primary">Konfirmasi Pembayaran</button></div></form></div></div>'
            );
            modal = document.getElementById('rentalPaymentModal');
          }
    
          const paymentForm = document.getElementById('rentalPaymentForm');
    
          setValue(
            'rental_payment_amount',
            String(Math.min(balance, totals.remaining))
          );
          setValue(
            'rental_payment_date',
            new Date().toISOString().slice(0, 10)
          );
    
          document.getElementById('rentalPaymentSummary').innerHTML =
            `<p><strong>${la.escape(rental.rental_code)}</strong><br>Customer: ${la.escape(rental.customers ? rental.customers.name : '-')}<br>Total tagihan: ${money(totals.total)}<br>Telah dibayar: ${money(totals.paid)}<br>Sisa tagihan: ${money(totals.remaining)}</p>`;
    
          const updatePreview = () => {
            const amount = Number(getValue('rental_payment_amount') || 0);
            const after = Math.max(totals.remaining - amount, 0);
            const status =
              amount > totals.remaining
                ? 'Nominal tidak valid'
                : after <= 0
                  ? 'LUNAS'
                  : 'SEBAGIAN DIBAYAR';
    
            document.getElementById('rentalPaymentPreview').innerHTML =
              `<strong>Sebelum Disimpan</strong><br>Nominal: ${money(amount)}<br>Sisa sebelum pembayaran: ${money(totals.remaining)}<br>Sisa setelah pembayaran: ${money(after)}<br>Status setelah pembayaran: ${status}`;
          };
    
          document.getElementById('rental_payment_amount').oninput = updatePreview;
          updatePreview();
          openModal('rentalPaymentModal');
    
          paymentForm.onsubmit = async event => {
            event.preventDefault();
    
            const amount = Number(getValue('rental_payment_amount') || 0);
    
            if (!amount || amount <= 0 || amount > totals.remaining) {
              la.toast(
                'Jumlah pembayaran tidak boleh melebihi sisa tagihan.',
                'error'
              );
              return;
            }
    
            const result = await supabase.rpc('record_rental_payment', {
              p_rental_id: rentalId,
              p_payment_date: getValue('rental_payment_date'),
              p_amount: amount,
              p_payment_method:
                document.getElementById('rental_payment_method').value,
              p_payment_type: 'PELUNASAN',
              p_payment_reference:
                getValue('rental_payment_reference') || null,
              p_notes: getValue('rental_payment_notes') || null
            });
    
            if (result.error) {
              la.toast(result.error.message, 'error');
              return;
            }
    
            const paymentRecord = Array.isArray(result.data)
              ? result.data[0]
              : result.data;
    
            closeModal('rentalPaymentModal');
    
            const newTotalPaid = totals.paid + amount;
            const receipt = document.createElement('div');
            receipt.className = 'modal show';
            receipt.id = 'paymentSuccessModal';
            receipt.innerHTML =
              `<div class="modal-box"><div class="modal-head"><h3>Pembayaran Berhasil</h3><button class="close" onclick="closeModal(\'paymentSuccessModal\')">×</button></div><p><strong>${la.escape(paymentRecord.payment_code || '-')}</strong><br>Rental: ${la.escape(rental.rental_code)}<br>Customer: ${la.escape(rental.customers ? rental.customers.name : '-')}<br>Nominal: ${money(amount)}<br>Metode: ${la.escape(paymentRecord.payment_method || '-')}<br>Total dibayar: ${money(newTotalPaid)}<br>Sisa: ${money(Math.max(totals.total - newTotalPaid, 0))}<br>Status: ${newTotalPaid >= totals.total ? 'LUNAS' : 'SEBAGIAN DIBAYAR'}</p><div class="form-actions"><button type="button" class="btn btn-primary" id="printPaymentReceiptButton">Cetak Bukti Pembayaran</button><button type="button" class="btn btn-light" onclick="closeModal(\'paymentSuccessModal\')">Tutup</button></div></div>`;
    
            document.body.appendChild(receipt);
            document
              .getElementById('printPaymentReceiptButton')
              .addEventListener('click', () =>
                printRentalPaymentReceipt({
                  rental,
                  payment: paymentRecord,
                  amount,
                  totalPaid: newTotalPaid,
                  remaining: Math.max(totals.total - newTotalPaid, 0),
                  rentalTotal: totals.total
                })
              );
            renderList();
          };
        }
    
        async function editRental(rental) {
          const newDueDate = window.prompt(
            'Tanggal jatuh tempo baru (YYYY-MM-DD):',
            rental.return_due_date
          );
    
          if (
            !newDueDate ||
            new Date(newDueDate) < new Date(rental.rental_date)
          ) {
            la.toast('Tanggal jatuh tempo tidak valid.', 'error');
            return;
          }
    
          const newStatus = window.prompt(
            'Status rental (Booked/Ongoing):',
            rental.rental_status || 'Booked'
          );
    
          if (!['Booked', 'Ongoing'].includes(newStatus)) {
            la.toast('Status rental tidak valid.', 'error');
            return;
          }
    
          const result = await supabase.rpc('update_rental_schedule', {
            p_rental_id: rental.id,
            p_return_due_date: newDueDate,
            p_rental_status: newStatus
          });
    
          if (result.error) {
            la.toast(result.error.message, 'error');
            return;
          }
    
          la.toast('Rental berhasil diperbarui.');
          closeModal('rentalDetailModal');
          renderList();
        }
    
        async function cancelRental(rentalId) {
          const rental = await getRentalRecord(rentalId);
          const totals = paymentTotals(rental);
          let modal = document.getElementById('rentalCancelModal');
    
          if (!modal) {
            document.body.insertAdjacentHTML(
              'beforeend',
              '<div class="modal" id="rentalCancelModal"><div class="modal-box"><div class="modal-head"><h3>Pembatalan Rental</h3><button class="close" onclick="closeModal(\'rentalCancelModal\')">×</button></div><form id="rentalCancelForm"><div id="rentalCancelSummary"></div><div class="field"><label>Alasan Pembatalan</label><textarea id="cancel_reason" required></textarea></div><div class="field"><label>Penanganan DP</label><label><input type="radio" name="cancel_action" value="REFUND" checked> Kembalikan DP</label><label><input type="radio" name="cancel_action" value="FORFEIT"> DP menjadi biaya pembatalan</label></div><div class="form-actions"><button type="button" class="btn btn-light" onclick="closeModal(\'rentalCancelModal\')">Batal</button><button type="submit" class="btn btn-primary">Konfirmasi Pembatalan</button></div></form></div></div>'
            );
            modal = document.getElementById('rentalCancelModal');
          }
    
          document.getElementById('rentalCancelSummary').innerHTML =
            `<p><strong>${la.escape(rental.rental_code)}</strong><br>Customer: ${la.escape(rental.customers ? rental.customers.name : '-')}<br>Total rental: ${money(totals.total)}<br>Total dibayar: ${money(totals.paid)}<br>Sisa: ${money(totals.remaining)}</p>`;
    
          document.querySelector(
            '#rentalCancelForm input[value="REFUND"]'
          ).disabled = totals.paid <= 0;
    
          if (totals.paid <= 0) {
            document.querySelector(
              '#rentalCancelForm input[value="FORFEIT"]'
            ).checked = true;
          }
    
          openModal('rentalCancelModal');
    
          document.getElementById('rentalCancelForm').onsubmit = async event => {
            event.preventDefault();
    
            const reason = getValue('cancel_reason').trim();
    
            if (!reason) {
              la.toast('Alasan pembatalan wajib diisi.', 'error');
              return;
            }
    
            const action = document.querySelector(
              'input[name="cancel_action"]:checked'
            ).value;
    
            const result = await supabase.rpc('cancel_rental', {
              p_rental_id: rentalId,
              p_reason: reason,
              p_deposit_action: action
            });
    
            if (result.error) {
              la.toast(result.error.message, 'error');
              return;
            }
    
            closeModal('rentalCancelModal');
            la.toast('Rental berhasil dibatalkan.');
            renderList();
          };
        }
    
        async function printRentalPaymentReceipt({
          rental,
          payment,
          amount,
          totalPaid,
          remaining,
          rentalTotal,
          documentType = 'payment',
          popupWindow = null
        }) {
          const popup = popupWindow || window.open('', '_blank');
    
          if (!popup) {
            la.toast('Popup bukti pembayaran diblokir browser.', 'error');
            return;
          }
    
          try {
            const settingsResult = await supabase
              .from('business_settings')
              .select('business_name, logo_url, address, phone, email, website')
              .eq('id', true)
              .maybeSingle();
            const company = settingsResult.data || {};
            const customer = rental.customers || {};
            const escape = value => la.escape(String(value ?? ''));
            const dateLabel = value => {
              if (!value) return '-';
              const date = new Date(`${value}T00:00:00`);
              return Number.isNaN(date.getTime())
                ? escape(value)
                : escape(date.toLocaleDateString('id-ID', { dateStyle: 'long' }));
            };
            const logoUrl = /^https?:\/\//i.test(company.logo_url || '')
              ? escape(company.logo_url)
              : '';
            const details = (rental.rental_details || []).map(item => {
              const dress = item.dresses || {};
              const variant = item.dress_variants || {};
              const unit = item.dress_units || {};
              const quantity = Number(item.quantity || 1);
              const subtotal = Number(
                item.subtotal ?? Number(item.rental_price || 0) * quantity
              );
              const variation = [variant.size, variant.color].filter(Boolean).join(' / ') || '-';
    
              return `<tr><td><strong>${escape(dress.name || 'Dress rental')}</strong><small>${escape(dress.dress_code || '-')} ${unit.unit_code ? `· Unit ${escape(unit.unit_code)}` : ''}</small></td><td>${escape(variation)}</td><td class="number">${quantity}</td><td class="number">${money(subtotal)}</td></tr>`;
            }).join('');
            const companyDetails = [
              company.address,
              [company.phone, company.email].filter(Boolean).join(' · '),
              company.website
            ].filter(Boolean).map(escape).join('<br>');
            const paymentStatus = remaining <= 0 ? 'LUNAS' : 'SEBAGIAN DIBAYAR';
            const isRentalInvoice = documentType === 'rental';
            const documentTitle = isRentalInvoice ? 'Invoice Penyewaan' : 'Bukti Pembayaran';
            const documentCode = isRentalInvoice
              ? rental.rental_code
              : payment.payment_code || rental.rental_code;
            const headlineLabel = isRentalInvoice ? 'Total nilai rental' : 'Jumlah diterima';
            const headlineAmount = isRentalInvoice ? rentalTotal : amount;
            const paymentDate = payment.payment_date
              ? dateLabel(payment.payment_date)
              : 'Belum ada pembayaran';
    
            popup.document.write(`<!doctype html>
              <html lang="id">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>${escape(documentTitle)} ${escape(documentCode)}</title>
                  <style>
                    *{box-sizing:border-box}
                    body{margin:0;padding:32px;background:#eef3f1;color:#203331;font:14px/1.55 Arial,sans-serif}
                    .receipt{max-width:780px;margin:0 auto;padding:42px;background:#fff;border:1px solid #dce7e3;box-shadow:0 12px 36px rgba(24,52,47,.08)}
                    .masthead{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:24px;border-bottom:2px solid #187d72}
                    .brand{display:flex;align-items:center;gap:14px;min-width:0}
                    .mark{width:54px;height:54px;flex:0 0 54px;display:grid;place-items:center;overflow:hidden;border-radius:11px;background:#e6f3ef;color:#187d72;font:30px Georgia,serif}
                    .mark img{width:100%;height:100%;object-fit:contain}
                    .brand h1{margin:0 0 5px;font-size:18px;letter-spacing:0}
                    .company-details{color:#71817e;font-size:11px}
                    .document{text-align:right}
                    .eyebrow{color:#187d72;font-size:10px;font-weight:700;letter-spacing:1.2px}
                    .document h2{margin:3px 0 7px;font-size:24px;letter-spacing:0}
                    .code{display:inline-block;padding:6px 9px;border-radius:6px;background:#edf5f2;color:#176e64;font-weight:700}
                    .issued{margin:7px 0 0;color:#71817e;font-size:11px}
                    .amount-panel{margin:24px 0;padding:20px;border-radius:9px;background:#18302f;color:#fff}
                    .amount-panel small{display:block;color:#c1d5cf;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
                    .amount-panel strong{display:block;margin-top:5px;font-size:30px;line-height:1.2}
                    .status{float:right;padding:6px 10px;border-radius:99px;background:#d7eee4;color:#176e50;font-size:10px;font-weight:700}
                    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:23px}
                    .info{padding:14px;border:1px solid #e1e9e6;border-radius:8px}
                    .label{display:block;color:#71817e;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
                    .info strong{display:block;margin-top:5px;font-size:14px}
                    .muted{display:block;margin-top:3px;color:#71817e;font-size:11px;overflow-wrap:anywhere}
                    table{width:100%;border-collapse:collapse}
                    th{padding:9px 7px;border-bottom:1px solid #cfdcd7;color:#71817e;font-size:9px;text-align:left;text-transform:uppercase}
                    td{padding:11px 7px;border-bottom:1px solid #e7eeeb;vertical-align:top}
                    td small{display:block;margin-top:3px;color:#71817e;font-size:10px}
                    .number{text-align:right;white-space:nowrap}
                    .total{width:min(100%,340px);margin:16px 0 0 auto}
                    .total-row{display:flex;justify-content:space-between;gap:18px;padding:6px 0;color:#5f716d}
                    .total-row strong{color:#203331}
                    .total-row.emphasis{margin-top:5px;padding-top:11px;border-top:1px solid #cfdcd7;font-weight:700}
                    .total-row.emphasis strong{color:#187d72;font-size:17px}
                    .reference{margin-top:20px;padding:12px 14px;border-left:3px solid #e47d65;background:#fff8f5;color:#5f716d;font-size:11px;overflow-wrap:anywhere}
                    .footer{display:flex;justify-content:space-between;gap:20px;margin-top:30px;padding-top:16px;border-top:1px solid #e1e9e6;color:#71817e;font-size:10px}
                    .actions{display:flex;justify-content:center;margin-top:22px}
                    .print-button{padding:11px 18px;border:0;border-radius:7px;background:#187d72;color:#fff;font-weight:700;cursor:pointer}
                    @media(max-width:600px){body{padding:0}.receipt{padding:24px 16px;border:0;box-shadow:none}.masthead{gap:14px}.mark{width:42px;height:42px;flex-basis:42px}.brand h1{font-size:15px}.company-details{font-size:9px}.document h2{font-size:18px}.amount-panel strong{font-size:25px}.grid{grid-template-columns:1fr}.footer{flex-direction:column}}
                    @page{size:A4;margin:16mm}
                    @media print{body{padding:0;background:#fff}.receipt{max-width:none;padding:0;border:0;box-shadow:none}.actions{display:none}.amount-panel,.status,.mark{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{break-inside:avoid}}
                  </style>
                </head>
                <body>
                  <article class="receipt">
                    <header class="masthead">
                      <div class="brand">
                        <div class="mark">${logoUrl ? `<img src="${logoUrl}" alt="">` : 'L'}</div>
                        <div><h1>${escape(company.business_name || 'LAVÉ DRESS RENTAL')}</h1><div class="company-details">${companyDetails || 'Bukti pembayaran transaksi penyewaan'}</div></div>
                      </div>
                      <div class="document"><span class="eyebrow">${isRentalInvoice ? 'RINGKASAN TRANSAKSI' : 'TANDA TERIMA RESMI'}</span><h2>${isRentalInvoice ? 'INVOICE PENYEWAAN' : 'BUKTI PEMBAYARAN'}</h2><span class="code">${escape(documentCode)}</span><p class="issued">Diterbitkan ${escape(new Date().toLocaleDateString('id-ID', { dateStyle: 'long' }))}</p></div>
                    </header>
    
                    <section class="amount-panel"><span class="status">${paymentStatus}</span><small>${headlineLabel}</small><strong>${money(headlineAmount)}</strong></section>
    
                    <section class="grid">
                      <div class="info"><span class="label">${isRentalInvoice ? 'Customer' : 'Diterima dari'}</span><strong>${escape(customer.name || '-')}</strong><span class="muted">${[customer.phone, customer.email, customer.address].filter(Boolean).map(escape).join('<br>') || 'Informasi kontak tidak tersedia'}</span></div>
                      <div class="info"><span class="label">${isRentalInvoice ? 'Pembayaran terakhir' : 'Detail pembayaran'}</span><strong>${paymentDate}</strong><span class="muted">Metode: ${escape(payment.payment_method || '-')}<br>Jenis: ${escape(payment.payment_type || 'PELUNASAN')}${payment.payment_code ? `<br>Kode pembayaran: ${escape(payment.payment_code)}` : ''}</span></div>
                      <div class="info"><span class="label">Transaksi rental</span><strong>${escape(rental.rental_code)}</strong><span class="muted">Periode: ${dateLabel(rental.rental_date)} – ${dateLabel(rental.return_due_date)}</span></div>
                      <div class="info"><span class="label">Ringkasan tagihan</span><strong>Total rental ${money(rentalTotal)}</strong><span class="muted">Total telah dibayar: ${money(totalPaid)}<br>Sisa tagihan: ${money(remaining)}</span></div>
                    </section>
    
                    <table><thead><tr><th>Item rental</th><th>Varian</th><th class="number">Qty</th><th class="number">Jumlah</th></tr></thead><tbody>${details || '<tr><td colspan="4">Pembayaran untuk transaksi penyewaan.</td></tr>'}</tbody></table>
    
                    <section class="total"><div class="total-row"><span>Total rental</span><strong>${money(rentalTotal)}</strong></div><div class="total-row"><span>${isRentalInvoice ? 'Pembayaran sebelum transaksi terakhir' : 'Pembayaran sebelumnya'}</span><strong>${money(Math.max(totalPaid - amount, 0))}</strong></div><div class="total-row emphasis"><span>${isRentalInvoice ? 'Pembayaran terakhir' : 'Pembayaran ini'}</span><strong>${money(amount)}</strong></div><div class="total-row"><span>${isRentalInvoice ? 'Sisa tagihan saat ini' : 'Sisa setelah pembayaran'}</span><strong>${money(remaining)}</strong></div></section>
    
                    ${(payment.payment_reference || payment.notes) ? `<div class="reference">${payment.payment_reference ? `Referensi: ${escape(payment.payment_reference)}` : ''}${payment.payment_reference && payment.notes ? '<br>' : ''}${payment.notes ? `Catatan: ${escape(payment.notes)}` : ''}</div>` : ''}
                    <footer class="footer"><span>${isRentalInvoice ? 'Ringkasan transaksi penyewaan LAVÉ.' : 'Terima kasih atas pembayaran Anda.'}</span><span>Dokumen ini diterbitkan secara digital.</span></footer>
                    <div class="actions"><button class="print-button" onclick="window.print()">Cetak / Simpan PDF</button></div>
                  </article>
                </body>
              </html>`);
            popup.document.close();
            popup.setTimeout(() => {
              popup.focus();
              popup.print();
            }, 400);
          } catch (error) {
            popup.close();
            la.toast(error.message || 'Bukti pembayaran gagal dibuat.', 'error');
          }
        }
    
        async function printRentalInvoice(rentalId) {
          const popup = window.open('', '_blank');
    
          if (!popup) {
            la.toast('Popup invoice diblokir browser.', 'error');
            return;
          }
    
          try {
            const rental = await getRentalRecord(rentalId);
            const totals = paymentTotals(rental);
            const payment = (rental.payments || [])
              .slice()
              .sort((first, second) =>
                String(second.payment_date || '').localeCompare(String(first.payment_date || '')) ||
                String(second.created_at || '').localeCompare(String(first.created_at || ''))
              )[0];
            const paymentAmount = !payment
              ? 0
              : payment.payment_type === 'REFUND'
                ? -Number(payment.amount || 0)
                : Number(payment.amount || 0);
    
            await printRentalPaymentReceipt({
              rental,
              payment: payment || {
                payment_code: rental.rental_code,
                payment_method: '-',
                payment_type: 'Belum ada pembayaran'
              },
              amount: paymentAmount,
              totalPaid: totals.paid,
              remaining: totals.remaining,
              rentalTotal: totals.total,
              documentType: 'rental',
              popupWindow: popup
            });
          } catch (error) {
            popup.close();
            la.toast(
              error.message || 'Invoice gagal dibuat.',
              'error'
            );
          }
        }
    
        search && search.addEventListener('input', renderList);
    
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
    
          let customerId = Number(getValue('customer_id'));
          const dressId = Number(getValue('dress_code') || 0);
          const dressVariantId = Number(getValue('dress_variant_id') || 0);
          const dressUnitId = Number(getValue('dress_unit_id') || 0);
          const rentalDate = getValue('rental_date');
          const returnDueDate = getValue('return_due_date');
          const depositAmount = Number(getValue('deposit_amount') || 0);
          const rentalPrice = Number(getValue('rental_price') || 0);
          const initialPayment = Number(getValue('initial_payment') || 0);
    
          if (
            !dressId ||
            !dressVariantId ||
            !dressUnitId ||
            !rentalDate ||
            !returnDueDate
          ) {
            la.toast(
              'Customer, model, ukuran, warna, unit fisik, dan tanggal wajib diisi.',
              'error'
            );
            return;
          }
    
          if (!customerId) {
            try {
              const customer = await ensureCustomerFromForm(
                getValue('customer_name'),
                getValue('customer_phone'),
                getValue('customer_email'),
                getValue('customer_address')
              );
    
              if (!customer) {
                la.toast(
                  'Pilih customer atau isi nama customer baru.',
                  'error'
                );
                return;
              }
    
              customerId = Number(customer.id);
            } catch (error) {
              la.toast(
                error.message || 'Customer gagal dibuat.',
                'error'
              );
              return;
            }
          }
    
          const dress = dressMap.get(String(dressId));
    
          const variant = variants.find(
            item =>
              Number(item.id) === dressVariantId &&
              Number(item.dress_id) === dressId
          );
    
          if (!dress || !variant) {
            la.toast('Model atau ukuran dress tidak valid.', 'error');
            return;
          }
    
          if (variant.available_quantity <= 0) {
            la.toast(
              'Ukuran tersebut tidak memiliki stok tersedia.',
              'error'
            );
            return;
          }
    
          if (new Date(returnDueDate) < new Date(rentalDate)) {
            la.toast(
              'Tanggal kembali tidak boleh lebih awal dari tanggal sewa.',
              'error'
            );
            return;
          }
    
          if (
            depositAmount < 0 ||
            initialPayment < 0 ||
            initialPayment > rentalPrice
          ) {
            la.toast(
              'Pembayaran awal tidak boleh melebihi total tagihan.',
              'error'
            );
            return;
          }
    
          const { error: transactionError } = await supabase.rpc(
            'create_rental_unit_transaction',
            {
              p_customer_id: customerId,
              p_dress_id: dress.id,
              p_dress_variant_id: variant.id,
              p_dress_unit_id: dressUnitId,
              p_rental_date: rentalDate,
              p_return_due_date: returnDueDate,
              p_total_rental: rentalPrice,
              p_rental_code: getValue('rental_code'),
              p_deposit_amount: depositAmount,
              p_rental_status:
                document.getElementById('rental_status').value,
              p_payment_amount: initialPayment,
              p_payment_date:
                getValue('initial_payment_date') || rentalDate,
              p_payment_method:
                document.getElementById('initial_payment_method').value,
              p_payment_type:
                document.getElementById('initial_payment_type').value
            }
          );
    
          if (transactionError) {
            la.toast(transactionError.message, 'error');
            return;
          }
    
          la.toast('Transaksi penyewaan berhasil disimpan.');
          closeModal('modal');
          form.reset();
    
          setValue('rental_code', await nextCode('rental'));
          setValue('rental_date', new Date().toISOString().slice(0, 10));
          setValue('return_due_date', defaultDate);
          setValue('deposit_amount', '0');
          setValue('total_amount', '0');
          setValue('initial_payment', '0');
          setValue(
            'initial_payment_date',
            new Date().toISOString().slice(0, 10)
          );
    
          updateRentalSummary();
    
          const refreshedVariants = await supabase
            .from('dress_variants')
            .select('*')
            .order('normalized_size');
    
          if (!refreshedVariants.error) {
            variants = refreshedVariants.data || [];
          }
    
          dressCodeInput.dispatchEvent(new Event('change'));
          renderList();
        });
    
        renderList();
      }
    
        async function initPurchasePage() {
        const root = document.querySelector('.main') || document.body;
        const legacyPage = document.querySelector('.page');
        if (legacyPage) legacyPage.style.display = 'none';
    
        const pageHtml = `
          <div class="card" style="padding:18px; margin-bottom:18px;">
            <h3>Pembelian Dress</h3>
            <form id="purchaseForm">
              <div class="form-grid">
                <div class="field">
                  <label>Kode Pembelian</label>
                  <input id="purchase_code" value="Memuat nomor pembelian..." readonly>
                </div>
                <div class="field"><label>Nama Supplier *</label><input id="purchase_supplier_name" required maxlength="100"></div>
                <div class="field"><label>No. Telepon Supplier</label><input id="purchase_supplier_phone" maxlength="30"></div>
                <div class="field"><label>Email Supplier</label><input id="purchase_supplier_email" type="email" maxlength="150"></div>
                <div class="field"><label>Alamat Supplier</label><input id="purchase_supplier_address" maxlength="250"></div>
                <div class="field">
                  <label>Tanggal Pembelian</label>
                  <input id="purchase_date" type="date" required>
                </div>
                <div class="field">
                  <label>Pilih Model Dress</label>
                  <div style="display:flex;gap:8px;align-items:center;">
                    <select id="dress_id"><option value="">Pilih model</option></select>
                    <button type="button" class="btn btn-light" id="createDressBtn">+ Dress Baru</button>
                  </div>
                </div>
                <div class="field">
                  <label>Kode Model</label>
                  <input id="new_dress_code" placeholder="Terbentuk saat pembelian disimpan" readonly>
                </div>
                <div class="field">
                  <label>Nama Model</label>
                  <input id="dress_name" placeholder="Nama dress">
                </div>
                <div class="field">
                  <label>Kategori</label>
                  <select id="category_id"></select>
                </div>
                <div class="field">
                  <label>Ukuran</label>
                  <select id="dress_size" required><option value="">Pilih ukuran</option></select>
                  <input id="new_dress_size" placeholder="Ukuran baru" maxlength="20" hidden>
                </div>
                <div class="field">
                  <label>Warna</label>
                  <input id="dress_color" maxlength="50" required>
                </div>
                <div class="field">
                  <label>Harga Beli</label>
                  <input id="purchase_price" type="number" min="0" required>
                </div>
                <div class="field">
                  <label>Harga Sewa</label>
                  <input id="rental_price" type="number" min="0" value="0">
                </div>
                <div class="field">
                  <label>Qty</label>
                  <input id="quantity" type="number" min="1" value="1" required>
                </div>
                <div class="field">
                  <label>Status Pembayaran</label>
                  <select id="purchase_payment_status"><option value="Unpaid">Kredit / Belum Dibayar</option><option value="Paid">Tunai / Sudah Dibayar</option></select>
                </div>
                <div class="field">
                  <label>Metode Pembayaran</label>
                  <select id="purchase_payment_method"><option>Cash</option><option>Transfer</option><option>E-Wallet</option></select>
                </div>
                <div class="field">
                  <label>Subtotal</label>
                  <input id="subtotal" type="number" min="0" readonly>
                </div>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">Simpan Pembelian</button>
              </div>
            </form>
          </div>
          <div class="card table-card">
            <div class="table-head"><strong>Riwayat Pembelian</strong></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Kode</th><th>Supplier</th><th>Tanggal</th><th>Nominal</th><th>Status</th></tr></thead>
                <tbody id="purchaseRows"></tbody>
              </table>
            </div>
          </div>
        `;
    
        root.insertAdjacentHTML('beforeend', pageHtml);
    
        const purchaseForm = document.getElementById('purchaseForm');
        const purchaseCodeInput = document.getElementById('purchase_code');
        const dressSelect = document.getElementById('dress_id');
        const categorySelect = document.getElementById('category_id');
        const purchaseRows = document.getElementById('purchaseRows');
        const purchasePriceInput = document.getElementById('purchase_price');
        const rentalPriceInput = document.getElementById('rental_price');
        const quantityInput = document.getElementById('quantity');
        const subtotalInput = document.getElementById('subtotal');
        const sizeSelect = document.getElementById('dress_size');
        const newSizeInput = document.getElementById('new_dress_size');
        let isNewModel = false;
    
        const [categories, dressRows, variantResult] = await Promise.all([
          loadCategories(),
          loadDresses(),
          supabase.from('dress_variants').select('*').order('normalized_size')
        ]);
    
        if (variantResult.error) {
          if (
            variantResult.error.code === 'PGRST205' &&
            variantResult.error.message.includes('dress_variants')
          ) {
            throw new Error('Database belum memiliki tabel varian dress. Jalankan migration 23-31 secara berurutan; tinjau pemetaan duplikat dan rekonsiliasi stocktake sebelum menyewakan stok UNVERIFIED. Jika tabel sudah ada, jalankan NOTIFY pgrst, \'reload schema\';');
          }
          throw variantResult.error;
        }
    
        const dresses = dressRows.filter(dress => dress.is_active !== false);
        let variants = variantResult.data || [];
        purchaseCodeInput.value = await nextPurchaseCode();
    
        categorySelect.innerHTML =
          '<option value="">Pilih Kategori</option>' +
          categories
            .map(c => `<option value="${c.id}">${c.category_name}</option>`)
            .join('');
    
        dressSelect.innerHTML =
          '<option value="">Pilih model</option>' +
          dresses
            .map(d => `<option value="${d.id}">${la.escape(d.dress_code)} - ${la.escape(d.name)}</option>`)
            .join('');
    
        document.getElementById('purchase_date').value =
          new Date().toISOString().slice(0, 10);
    
        function updateSizeOptions(dressId) {
          const sizes = [
            ...new Set(
              variants
                .filter(variant => Number(variant.dress_id) === Number(dressId))
                .map(variant => variant.size)
            )
          ];
    
          sizeSelect.innerHTML =
            '<option value="">Pilih ukuran</option>' +
            sizes
              .map(size => `<option value="${la.escape(size)}">${la.escape(size)}</option>`)
              .join('') +
            '<option value="__new__">+ Ukuran baru</option>';
    
          sizeSelect.value = '';
          newSizeInput.value = '';
          newSizeInput.hidden = false;
          newSizeInput.hidden = true;
        }
    
        function selectedSize() {
          return sizeSelect.value === '__new__'
            ? newSizeInput.value.trim().toUpperCase()
            : sizeSelect.value;
        }
    
        function updateSubtotal() {
          const subtotal =
            Number(purchasePriceInput.value || 0) *
            Number(quantityInput.value || 1);
          subtotalInput.value = String(subtotal);
        }
    
        purchasePriceInput.addEventListener('input', updateSubtotal);
        quantityInput.addEventListener('input', updateSubtotal);
    
        sizeSelect.addEventListener('change', () => {
          newSizeInput.hidden = sizeSelect.value !== '__new__';
          if (sizeSelect.value === '__new__') newSizeInput.focus();
        });
    
        dressSelect.addEventListener('change', () => {
          const selected = dresses.find(
            d => Number(d.id) === Number(dressSelect.value)
          );
    
          if (!selected) return;
    
          isNewModel = false;
          document.getElementById('new_dress_code').value =
            selected.dress_code || '';
          document.getElementById('dress_name').value =
            selected.name || '';
          document.getElementById('dress_name').readOnly = true;
          categorySelect.value =
            selected.category_id ? String(selected.category_id) : '';
          categorySelect.disabled = true;
          document.getElementById('dress_color').value =
            selected.color || '';
          document.getElementById('dress_color').readOnly = false;
          purchasePriceInput.value = Number(selected.purchase_price || 0);
          rentalPriceInput.value = Number(selected.rental_price || 0);
          updateSizeOptions(selected.id);
          updateSubtotal();
        });
    
        async function renderPurchaseRows() {
          const { data, error } = await supabase
            .from('purchases')
            .select('*')
            .order('id', { ascending: false });
    
          if (error) {
            la.toast(error.message, 'error');
            return;
          }
    
          purchaseRows.innerHTML = (data || []).length
            ? (data || [])
                .map(p => `
            <tr>
              <td>${la.escape(p.purchase_code)}</td>
              <td>${la.escape(p.supplier_name || '-')}<small>${la.escape([p.supplier_phone, p.supplier_email].filter(Boolean).join(' · ') || 'Kontak tidak dicatat')}</small></td>
              <td>${la.formatDate(p.purchase_date)}</td>
              <td>${money(p.total_amount)}</td>
              <td>${la.escape(p.payment_status || 'Unpaid')}</td>
            </tr>
          `)
                .join('')
            : '<tr><td colspan="5" class="empty">Belum ada pembelian.</td></tr>';
        }
    
        document.getElementById('createDressBtn').addEventListener('click', () => {
          isNewModel = true;
          dressSelect.value = '';
          document.getElementById('new_dress_code').value =
            'Dibuat otomatis saat pembelian disimpan';
          document.getElementById('dress_name').value = '';
          document.getElementById('dress_name').readOnly = false;
          categorySelect.value = '';
          categorySelect.disabled = false;
          document.getElementById('dress_color').value = '';
          document.getElementById('dress_color').readOnly = false;
          sizeSelect.innerHTML =
            '<option value="__new__">Masukkan ukuran pertama</option>';
          sizeSelect.value = '__new__';
          newSizeInput.value = '';
          newSizeInput.hidden = false;
          purchasePriceInput.value = '';
          rentalPriceInput.value = '0';
          updateSubtotal();
        });
    
        purchaseForm.addEventListener('submit', async (event) => {
          event.preventDefault();
    
          const supplierName = document.getElementById('purchase_supplier_name').value.trim();
          const purchaseDate =
            document.getElementById('purchase_date').value;
          const purchasePrice = Number(purchasePriceInput.value || 0);
          const rentalPrice = Number(rentalPriceInput.value || 0);
          const quantity = Number(quantityInput.value || 1);
          const subtotal = Number(subtotalInput.value || 0);
          const selectedDressId =
            !isNewModel && dressSelect.value
              ? Number(dressSelect.value)
              : null;
          const selectedSizeValue = selectedSize();
          const selectedColorValue =
            document.getElementById('dress_color').value.trim();
    
          if (
            !purchaseCodeInput.value ||
            !supplierName ||
            !purchaseDate ||
            purchasePrice <= 0 ||
            !Number.isInteger(quantity) ||
            quantity <= 0 ||
            !selectedSizeValue ||
            !selectedColorValue
          ) {
            la.toast(
              'Nama supplier, tanggal, model, ukuran, warna, harga beli, dan quantity valid wajib diisi.',
              'error'
            );
            return;
          }
    
          if (!isNewModel && !selectedDressId) {
            la.toast(
              'Pilih model dress atau gunakan tombol Dress Baru.',
              'error'
            );
            return;
          }
    
          if (
            isNewModel &&
            (
              !document.getElementById('dress_name').value.trim() ||
              !categorySelect.value
            )
          ) {
            la.toast(
              'Nama dan kategori wajib diisi untuk model dress baru.',
              'error'
            );
            return;
          }
    
          if (isNewModel) {
            const newName =
              document.getElementById('dress_name').value.trim().toLowerCase();
            const newCategory = Number(categorySelect.value);
    
            const duplicateModel = dresses.find(
              dress =>
                dress.name.trim().toLowerCase() === newName &&
                Number(dress.category_id) === newCategory
            );
    
            if (duplicateModel) {
              la.toast(
                `Model ${duplicateModel.dress_code} sudah ada. Pilih model tersebut lalu tambahkan ukuran dan warna.`,
                'error'
              );
              return;
            }
          }
    
          try {
            const { data: purchaseResult, error: purchaseError } =
              await supabase.rpc('create_purchase_transaction_with_reserved_code', {
                p_purchase_code: purchaseCodeInput.value,
                p_supplier_name: supplierName,
                p_supplier_phone:
                  document.getElementById('purchase_supplier_phone').value.trim() || null,
                p_supplier_email:
                  document.getElementById('purchase_supplier_email').value.trim() || null,
                p_supplier_address:
                  document.getElementById('purchase_supplier_address').value.trim() || null,
                p_purchase_date: purchaseDate,
                p_payment_status:
                  document.getElementById('purchase_payment_status').value,
                p_payment_method:
                  document.getElementById('purchase_payment_method').value,
                p_dress_id: selectedDressId,
                p_dress_name:
                  document.getElementById('dress_name').value.trim() || null,
                p_category_id:
                  categorySelect.value ? Number(categorySelect.value) : null,
                p_size: selectedSizeValue,
                p_color:
                  document.getElementById('dress_color').value.trim() || null,
                p_purchase_price: purchasePrice,
                p_rental_price: rentalPrice,
                p_quantity: quantity
              });
    
            if (purchaseError?.code === 'PGRST202') {
              throw new Error(
                'Database belum menerapkan Migration 40 untuk mengurutkan nomor pembelian berdasarkan transaksi tersimpan.'
              );
            }
            if (purchaseError) throw purchaseError;
    
            la.toast('Pembelian dress berhasil disimpan.');
            purchaseForm.reset();
            isNewModel = false;
            categorySelect.disabled = false;
            document.getElementById('dress_name').readOnly = false;
            document.getElementById('dress_color').readOnly = false;
            sizeSelect.innerHTML =
              '<option value="">Pilih ukuran</option>';
            newSizeInput.hidden = true;
            try {
              purchaseCodeInput.value = await nextPurchaseCode();
            } catch (codeError) {
              purchaseCodeInput.value = 'Gagal membuat nomor pembelian';
              la.handleSupabaseError(codeError, {
                module: 'Purchase',
                operation: 'GENERATE_CODE'
              });
              la.toast(
                `Pembelian tersimpan, tetapi nomor untuk transaksi berikutnya gagal dibuat: ${codeError.message}`,
                'error'
              );
            }
            document.getElementById('purchase_date').value =
              new Date().toISOString().slice(0, 10);
            purchasePriceInput.value = '';
            rentalPriceInput.value = '0';
            quantityInput.value = '1';
            subtotalInput.value = '0';
    
            try {
              const [refreshedDresses, refreshedVariants] =
                await Promise.all([
                  loadDresses(),
                  supabase
                    .from('dress_variants')
                    .select('*')
                    .order('normalized_size')
                ]);
    
              if (refreshedVariants.error) {
                throw refreshedVariants.error;
              }
    
              dresses.splice(
                0,
                dresses.length,
                ...refreshedDresses.filter(
                  dress => dress.is_active !== false
                )
              );
    
              variants = refreshedVariants.data || [];
    
              dressSelect.innerHTML =
                '<option value="">Pilih model</option>' +
                dresses
                  .map(
                    dress =>
                      `<option value="${dress.id}">${la.escape(dress.dress_code)} - ${la.escape(dress.name)}</option>`
                  )
                  .join('');
            } catch (refreshError) {
              la.toast(
                `Pembelian tersimpan, tetapi pilihan model perlu dimuat ulang: ${refreshError.message}`,
                'error'
              );
            }
    
            renderPurchaseRows();
          } catch (error) {
            la.toast(
              error.message || 'Pembelian gagal disimpan.',
              'error'
            );
          }
        });
    
        renderPurchaseRows();
        updateSubtotal();
      }
    
        async function initPayablePage(embedded = false) {
        const root = document.querySelector('.main') || document.body;
        const legacyPage = document.querySelector('.page');
        if (!embedded && legacyPage) legacyPage.style.display = 'none';
    
        const pageHtml = `
          <div class="card" style="padding:18px; margin-bottom:18px;">
            <h3>Pembayaran Utang Usaha</h3>
            <p class="muted">Utang pembelian yang belum lunas terdeteksi otomatis di daftar ini.</p>
            <form id="payableForm">
              <div class="form-grid">
                <div class="field"><label>Utang Pembelian</label><select id="payable_purchase_id" required></select></div>
                <div class="field"><label>Supplier</label><input id="payable_supplier" readonly></div>
                <div class="field"><label>Total Pembelian</label><input id="payable_total" readonly></div>
                <div class="field"><label>Total Terbayar</label><input id="payable_paid" readonly></div>
                <div class="field"><label>Sisa Utang</label><input id="payable_balance" readonly></div>
                <div class="field"><label>Tanggal Pembayaran</label><input id="payable_date" type="date" required></div>
                <div class="field"><label>Jumlah Pembayaran</label><input id="payable_amount" type="number" min="0.01" step="0.01" required></div>
                <div class="field"><label>Metode Pembayaran</label><select id="payable_method"><option>Cash</option><option>Transfer</option><option>E-Wallet</option></select></div>
                <div class="field"><label>Keterangan</label><input id="payable_description"></div>
              </div>
              <div class="form-actions"><button type="submit" class="btn btn-primary">Simpan Pembayaran Utang</button></div>
            </form>
          </div>
          <div class="card table-card"><div class="table-head"><strong>Daftar Utang Supplier</strong></div><div class="table-wrap"><table><thead><tr><th>Pembelian</th><th>Supplier</th><th>Total</th><th>Terbayar</th><th>Sisa</th><th>Status</th></tr></thead><tbody id="payableRows"></tbody></table></div></div>
        `;
    
        root.insertAdjacentHTML('beforeend', pageHtml);
    
        const purchaseSelect = document.getElementById('payable_purchase_id');
        const form = document.getElementById('payableForm');
        const rows = document.getElementById('payableRows');
        let purchaseList = [];
    
        setValue('payable_date', new Date().toISOString().slice(0, 10));
    
        async function refreshPayables() {
          const result = await supabase
            .from('v_purchase_payables')
            .select('*')
            .order('purchase_date', { ascending: false });
    
          if (result.error) throw result.error;
    
          purchaseList = result.data || [];
    
          purchaseSelect.innerHTML =
            '<option value="">Pilih utang yang akan dibayar</option>' +
            purchaseList
              .map(
                p =>
                  `<option value="${p.purchase_id}">${la.escape(p.purchase_code)} - sisa ${money(p.remaining_amount)}</option>`
              )
              .join('');
    
          await renderPayables();
        }
    
        async function updateSelectedPurchase() {
          const purchase = purchaseList.find(
            item => Number(item.purchase_id) === Number(purchaseSelect.value)
          );
    
          if (!purchase) {
            [
              'payable_supplier',
              'payable_total',
              'payable_paid',
              'payable_balance',
              'payable_amount'
            ].forEach(id => setValue(id, ''));
            return;
          }
    
          const total = Number(purchase.total_amount || 0);
          const paid = Number(purchase.paid_amount || 0);
    
          setValue('payable_total', String(total));
          setValue('payable_paid', String(paid));
          setValue('payable_supplier', purchase.supplier_name || '-');
          setValue('payable_balance', String(purchase.remaining_amount));
          setValue('payable_amount', String(purchase.remaining_amount));
        }
    
        async function renderPayables() {
          rows.innerHTML = purchaseList.length
            ? purchaseList
                .map(p => {
                  const paid = Number(p.paid_amount || 0);
                  const status = paid > 0 ? 'Sebagian' : 'Belum Dibayar';
    
                  return `<tr><td>${la.escape(p.purchase_code)}</td><td>${la.escape(p.supplier_name || '-')}</td><td>${money(p.total_amount)}</td><td>${money(paid)}</td><td>${money(p.remaining_amount)}</td><td>${statusBadge(status)}</td></tr>`;
                })
                .join('')
            : '<tr><td colspan="6" class="empty">Tidak ada utang outstanding.</td></tr>';
        }
    
        purchaseSelect.addEventListener('change', () =>
          updateSelectedPurchase().catch(error =>
            la.toast(error.message, 'error')
          )
        );
    
        form.addEventListener('submit', async event => {
          event.preventDefault();
    
          const purchaseId = Number(purchaseSelect.value || 0);
          const amount = Number(getValue('payable_amount') || 0);
          const balance = Number(getValue('payable_balance') || 0);
    
          if (!purchaseId || !getValue('payable_date') || amount <= 0) {
            la.toast(
              'Pembelian, tanggal, dan jumlah pembayaran wajib diisi.',
              'error'
            );
            return;
          }
    
          if (amount > balance) {
            la.toast(
              'Pembayaran tidak boleh melebihi sisa utang.',
              'error'
            );
            return;
          }
    
          const result = await supabase.rpc('record_purchase_payment', {
            p_purchase_id: purchaseId,
            p_payment_date: getValue('payable_date'),
            p_amount: amount,
            p_payment_method: document.getElementById('payable_method').value,
            p_description: getValue('payable_description') || null
          });
    
          if (result.error) {
            la.toast(result.error.message, 'error');
            return;
          }
    
          la.toast('Pembayaran utang berhasil dicatat.');
          form.reset();
          setValue('payable_date', new Date().toISOString().slice(0, 10));
          await refreshPayables();
          await updateSelectedPurchase();
        });
    
        await refreshPayables();
      }
    
      async function initExpensePage() {
        const root = document.querySelector('.main') || document.body;
        const legacyPage = document.querySelector('.page');
        if (legacyPage) legacyPage.remove();
    
        const pageHtml = `
          <section class="page">
            <div class="page-title">
              <div><h2>Pembayaran Usaha</h2><p>Catat pengeluaran dan bayar utang pembelian dari satu halaman.</p></div>
              <div class="form-actions">
                <button class="btn btn-light" id="manageExpenseCategories" type="button">Kelola Kategori</button>
                <button class="btn btn-light" type="button" onclick="window.print()">Cetak</button>
              </div>
            </div>
            <div class="card" style="padding:18px; margin-bottom:18px;">
            <h3>Catat Pembayaran Usaha</h3>
            <form id="expenseForm">
              <div class="form-grid">
                <div class="field"><label>Nomor Pembayaran</label><input id="expense_code" readonly required></div>
                <div class="field"><label>Tanggal</label><input id="expense_date" type="date" required></div>
                <div class="field"><label>Kategori</label><select id="expense_category_id" required></select></div>
                <div class="field"><label>Jumlah</label><input id="expense_amount" type="number" min="1" step="0.01" required></div>
                <div class="field"><label>Metode Pembayaran</label><select id="expense_method"><option>Cash</option><option>Transfer</option><option>E-Wallet</option></select></div>
                <div class="field"><label>Status Pembayaran</label><select id="expense_status"><option value="Paid">Sudah Dibayar</option><option value="Unpaid">Belum Dibayar</option></select></div>
                <div class="field"><label>Penerima/Supplier</label><input id="expense_recipient"></div>
                <div class="field"><label>Keterangan</label><input id="expense_description"></div>
              </div>
              <div class="form-actions"><button id="expenseSubmit" type="submit" class="btn btn-primary">Simpan Pembayaran</button></div>
            </form>
          </div>
          <div class="card table-card"><div class="table-head"><strong>Riwayat Pembayaran Usaha</strong></div><div class="table-wrap"><table><thead><tr><th>Kode</th><th>Kategori</th><th>Tanggal</th><th>Jumlah</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="expenseRows"></tbody></table></div></div>
          <div class="modal" id="expenseCategoryModal">
            <div class="modal-box">
              <div class="modal-head"><h3>Kelola Kategori Pembayaran</h3><button class="close" id="closeExpenseCategoryModal" type="button">×</button></div>
              <form id="expenseCategoryForm">
                <input id="expenseCategoryId" type="hidden">
                <div class="form-grid">
                  <div class="field"><label>Nama Kategori</label><input id="expenseCategoryName" maxlength="100" required></div>
                </div>
                <div class="form-actions">
                  <button class="btn btn-light" id="resetExpenseCategoryForm" type="button">Batal Edit</button>
                  <button class="btn btn-primary" id="saveExpenseCategory" type="submit">Tambah Kategori</button>
                </div>
              </form>
              <div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>Kategori</th><th>Aksi</th></tr></thead><tbody id="expenseCategoryRows"></tbody></table></div>
            </div>
          </div>
          </section>
        `;
    
        root.insertAdjacentHTML('beforeend', pageHtml);
    
        const form = document.getElementById('expenseForm');
        const categorySelect = document.getElementById('expense_category_id');
        const rows = document.getElementById('expenseRows');
    
        let expenseCategories = [];
        const categoryModal = document.getElementById('expenseCategoryModal');
        const categoryRows = document.getElementById('expenseCategoryRows');
        const categoryForm = document.getElementById('expenseCategoryForm');
        const resetExpenseCategoryForm = () => {
          categoryForm.reset();
          setValue('expenseCategoryId', '');
          document.getElementById('saveExpenseCategory').textContent = 'Tambah Kategori';
        };

        async function loadExpenseCategories() {
          const result = await supabase
            .from('expense_categories')
            .select('id, category_name')
            .order('category_name');
          if (result.error) {
            la.handleSupabaseError(result.error, {module: 'ExpenseCategory', operation: 'SELECT'});
            la.toast(result.error.message, 'error');
            return;
          }

          expenseCategories = result.data || [];
          const selectedCategory = categorySelect.value;
          categorySelect.innerHTML =
            '<option value="">Pilih Kategori</option>' +
            expenseCategories
              .map(category =>
                `<option value="${category.id}">${la.escape(category.category_name)}</option>`
              )
              .join('');
          if (expenseCategories.some(category => String(category.id) === selectedCategory)) {
            categorySelect.value = selectedCategory;
          }

          if (categoryRows) {
            categoryRows.innerHTML = expenseCategories.length
              ? expenseCategories.map(category =>
                  `<tr><td>${la.escape(category.category_name)}</td><td><button class="btn btn-light expense-category-edit" type="button" data-id="${category.id}">Edit</button> <button class="btn btn-danger expense-category-delete" type="button" data-id="${category.id}">Hapus</button></td></tr>`
                ).join('')
              : '<tr><td colspan="2" class="empty">Belum ada kategori biaya.</td></tr>';

            categoryRows.querySelectorAll('.expense-category-edit').forEach(button =>
              button.addEventListener('click', () => {
                const category = expenseCategories.find(item => String(item.id) === button.dataset.id);
                if (!category) return;
                setValue('expenseCategoryId', category.id);
                setValue('expenseCategoryName', category.category_name);
                document.getElementById('saveExpenseCategory').textContent = 'Simpan Perubahan';
              })
            );

            categoryRows.querySelectorAll('.expense-category-delete').forEach(button =>
              button.addEventListener('click', async () => {
                const category = expenseCategories.find(item => String(item.id) === button.dataset.id);
                if (!category || !confirm(`Hapus kategori "${category.category_name}"? Biaya yang sudah dicatat tetap disimpan tanpa kategori.`)) return;

                const deletion = await supabase
                  .from('expense_categories')
                  .delete()
                  .eq('id', category.id);
                if (deletion.error) {
                  la.handleSupabaseError(deletion.error, {module: 'ExpenseCategory', operation: 'DELETE'});
                  la.toast(deletion.error.message, 'error');
                  return;
                }

                la.toast('Kategori biaya berhasil dihapus.');
                resetExpenseCategoryForm();
                await loadExpenseCategories();
                await renderExpenses();
              })
            );
          }
        }

        document.getElementById('manageExpenseCategories').addEventListener('click', async () => {
          resetExpenseCategoryForm();
          categoryModal.classList.add('show');
          await loadExpenseCategories();
        });
        document.getElementById('closeExpenseCategoryModal').addEventListener('click', () =>
          categoryModal.classList.remove('show')
        );
        document.getElementById('resetExpenseCategoryForm').addEventListener('click', resetExpenseCategoryForm);
        categoryForm.addEventListener('submit', async event => {
          event.preventDefault();
          const categoryName = getValue('expenseCategoryName').trim();
          const categoryId = getValue('expenseCategoryId');
          if (!categoryName) {
            la.toast('Nama kategori wajib diisi.', 'error');
            return;
          }

          const query = categoryId
            ? supabase.from('expense_categories').update({category_name: categoryName}).eq('id', categoryId)
            : supabase.from('expense_categories').insert({category_name: categoryName});
          const result = await query;
          if (result.error) {
            la.handleSupabaseError(result.error, {module: 'ExpenseCategory', operation: categoryId ? 'UPDATE' : 'INSERT'});
            la.toast(result.error.message, 'error');
            return;
          }

          la.toast(categoryId ? 'Kategori biaya berhasil diperbarui.' : 'Kategori biaya berhasil ditambahkan.');
          resetExpenseCategoryForm();
          await loadExpenseCategories();
          await renderExpenses();
        });

        await loadExpenseCategories();
    
        setValue('expense_code', await nextCode('expense'));
        setValue('expense_date', new Date().toISOString().slice(0, 10));
    
        async function renderExpenses() {
          const result = await supabase
            .from('expenses')
            .select('*, expense_categories(category_name)')
            .order('id', { ascending: false });
    
          if (result.error) {
            la.toast(result.error.message, 'error');
            return;
          }
    
          rows.innerHTML = (result.data || []).length
            ? result.data
                .map(expense => `
            <tr>
              <td>${la.escape(expense.expense_code)}</td>
              <td>${la.escape(expense.expense_categories ? expense.expense_categories.category_name : '-')}</td>
              <td>${la.formatDate(expense.expense_date)}</td>
              <td>${money(expense.amount)}</td>
              <td>${statusBadge(expense.payment_status || 'Paid')}</td>
              <td>${expense.payment_status === 'Unpaid' ? `<button type="button" class="btn btn-light expense-pay" data-id="${expense.id}">Bayar</button>` : '-'}</td>
            </tr>
          `)
                .join('')
            : '<tr><td colspan="6" class="empty">Belum ada pembayaran usaha.</td></tr>';
    
          rows
            .querySelectorAll('.expense-pay')
            .forEach(button =>
              button.addEventListener('click', async () => {
                const expenseId = Number(button.dataset.id);
                const amount = Number(
                  window.prompt('Jumlah pembayaran biaya:', '') || 0
                );
    
                if (!amount || amount <= 0) return;
    
                const expenseResult = await supabase
                  .from('expenses')
                  .select('amount')
                  .eq('id', expenseId)
                  .single();
    
                if (expenseResult.error) {
                  la.toast(expenseResult.error.message, 'error');
                  return;
                }
    
                const paymentsResult = await supabase
                  .from('expense_payments')
                  .select('amount')
                  .eq('expense_id', expenseId);
    
                if (paymentsResult.error) {
                  la.toast(paymentsResult.error.message, 'error');
                  return;
                }
    
                const paid = (paymentsResult.data || []).reduce(
                  (sum, payment) =>
                    sum + Number(payment.amount || 0),
                  0
                );
    
                const balance = Math.max(
                  Number(expenseResult.data.amount || 0) - paid,
                  0
                );
    
                if (amount > balance) {
                  la.toast(
                    'Pembayaran biaya tidak boleh melebihi sisa kewajiban.',
                    'error'
                  );
                  return;
                }
    
                const result = await supabase.rpc(
                  'record_expense_payment',
                  {
                    p_expense_id: expenseId,
                    p_payment_date:
                      new Date().toISOString().slice(0, 10),
                    p_amount: amount,
                    p_payment_method: 'Cash',
                    p_description: 'Pelunasan pembayaran usaha'
                  }
                );
    
                if (result.error) {
                  la.toast(result.error.message, 'error');
                  return;
                }
    
                la.toast('Pembayaran usaha berhasil dicatat.');
                await renderExpenses();
              })
            );
        }
    
        form.addEventListener('submit', async event => {
          event.preventDefault();
    
          const amount = Number(getValue('expense_amount') || 0);
    
          if (
            !getValue('expense_date') ||
            !categorySelect.value ||
            amount <= 0
          ) {
            la.toast(
              'Tanggal, kategori, dan jumlah biaya wajib diisi.',
              'error'
            );
            return;
          }
    
          const submitButton = document.getElementById('expenseSubmit');
          submitButton.disabled = true;
          try {
            const result = await supabase.from('expenses').insert({
              expense_code:
                getValue('expense_code') || await nextCode('expense'),
              category_id: Number(categorySelect.value),
              expense_date: getValue('expense_date'),
              amount,
              payment_method:
                document.getElementById('expense_method').value,
              payment_status:
                document.getElementById('expense_status').value,
              recipient: getValue('expense_recipient') || null,
              description: getValue('expense_description') || null
            });
    
            if (result.error) {
              la.handleSupabaseError(result.error, {module: 'Expense', operation: 'INSERT'});
              la.toast(result.error.message, 'error');
              return;
            }
    
            la.toast('Pembayaran usaha berhasil disimpan.');
            form.reset();
            setValue('expense_date', new Date().toISOString().slice(0, 10));
            setValue('expense_code', await nextCode('expense'));
            await renderExpenses();
          } finally {
            submitButton.disabled = false;
          }
        });
    
        await Promise.all([renderExpenses(), initPayablePage(true)]);
      }
    
      async function initPaymentPage() {
        const root = document.querySelector('.main') || document.body;
    
        const pageHtml = `
          <div class="card" style="padding:18px; margin-bottom:18px;">
            <h3>Pembayaran Penyewaan</h3>
            <form id="paymentForm">
              <div class="form-grid">
                <div class="field"><label>Nomor Penyewaan</label><select id="rental_id" required></select></div>
                <div class="field"><label>Customer</label><input id="customer_name" readonly></div>
                <div class="field"><label>Kode Dress</label><input id="dress_code" readonly></div>
                <div class="field"><label>Nama Dress</label><input id="dress_name" readonly></div>
                <div class="field"><label>Ukuran</label><input id="dress_size" readonly></div>
                <div class="field"><label>Warna</label><input id="dress_color" readonly></div>
                <div class="field"><label>Warna</label><input id="dress_color" readonly></div>
                <div class="field"><label>Tanggal Sewa</label><input id="rental_date" readonly></div>
                <div class="field"><label>Tanggal Kembali</label><input id="return_due_date" readonly></div>
                <div class="field"><label>Total Tagihan</label><input id="total_amount" readonly></div>
                <div class="field"><label>Deposit</label><input id="deposit_amount" readonly></div>
                <div class="field"><label>Total Dibayar</label><input id="paid_amount" readonly></div>
                <div class="field"><label>Sisa Tagihan</label><input id="balance_amount" readonly></div>
                <div class="field"><label>Status</label><input id="payment_status" readonly></div>
                <div class="field"><label>Tanggal Pembayaran</label><input id="payment_date" type="date" required></div>
                <div class="field"><label>Jumlah Pembayaran</label><input id="amount" type="number" min="0" required></div>
                <div class="field"><label>Metode Pembayaran</label><select id="payment_method"><option value="Cash">Cash</option><option value="Transfer">Transfer</option><option value="E-Wallet">E-Wallet</option></select></div>
                <div class="field"><label>Tipe Pembayaran</label><select id="payment_type"><option value="PELUNASAN">Pelunasan</option><option value="DP">DP</option></select></div>
                <div class="field"><label>Keterangan</label><input id="description"></div>
              </div>
              <div class="form-actions"><button type="submit" class="btn btn-primary">Simpan Pembayaran</button></div>
            </form>
          </div>
          <div class="card table-card"><div class="table-head"><strong>Riwayat Pembayaran</strong></div><div class="table-wrap"><table><thead><tr><th>Kode</th><th>Rental</th><th>Tanggal</th><th>Jumlah</th><th>Metode</th></tr></thead><tbody id="paymentRows"></tbody></table></div></div>
        `;
    
        root.insertAdjacentHTML('beforeend', pageHtml);
    
        const rentalSelect = document.getElementById('rental_id');
        const form = document.getElementById('paymentForm');
        const paymentRows = document.getElementById('paymentRows');
    
        async function renderPaymentRows() {
          const { data, error } = await supabase
            .from('payments')
            .select('*')
            .order('id', { ascending: false });
    
          if (error) {
            la.toast(error.message, 'error');
            return;
          }
    
          paymentRows.innerHTML = (data || []).length
            ? (data || [])
                .map(p => `
            <tr><td>${la.escape(p.payment_code)}</td><td>${la.escape(p.rental_id)}</td><td>${la.formatDate(p.payment_date)}</td><td>${money(p.amount)}</td><td>${la.escape(p.payment_method || '-')}</td></tr>
          `)
                .join('')
            : '<tr><td colspan="5" class="empty">Belum ada data pembayaran.</td></tr>';
        }
    
        const rentals = await loadRentalOptions();
    
        rentalSelect.innerHTML =
          '<option value="">Pilih nomor penyewaan</option>' +
          rentals
            .map(r => `<option value="${r.id}">${r.rental_code}</option>`)
            .join('');
    
        rentalSelect.addEventListener('change', async () => {
          const rentalId = Number(rentalSelect.value);
          if (!rentalId) return;
    
          const { data, error } = await supabase
            .from('rentals')
            .select(
              '*, customers(name), rental_details(*, dresses(dress_code,name,color,rental_price), dress_variants(size,color))'
            )
            .eq('id', rentalId)
            .single();
    
          if (error) {
            la.toast(error.message, 'error');
            return;
          }
    
          const detail = (data.rental_details || [])[0] || {};
          const dress = detail.dresses || {};
    
          const paymentResult = await supabase
            .from('payments')
            .select('amount,payment_type')
            .eq('rental_id', rentalId);
    
          if (paymentResult.error) {
            la.toast(paymentResult.error.message, 'error');
            return;
          }
    
          const totalPaid = (paymentResult.data || []).reduce(
            (sum, payment) =>
              sum +
              (payment.payment_type === 'REFUND'
                ? -Number(payment.amount || 0)
                : ['DP', 'PELUNASAN'].includes(payment.payment_type)
                  ? Number(payment.amount || 0)
                  : 0),
            0
          );
    
          const total = Number(
            data.total_rental ?? data.total_amount ?? 0
          );
          const balance = total - totalPaid;
    
          setValue(
            'customer_name',
            data.customers ? data.customers.name : ''
          );
          setValue('dress_code', dress.dress_code || '');
          setValue('dress_name', dress.name || '');
          setValue('dress_size', detail.dress_variants?.size || '');
          setValue('dress_color', detail.dress_variants?.color || '');
          setValue('rental_date', data.rental_date || '');
          setValue('return_due_date', data.return_due_date || '');
          setValue('total_amount', String(total));
          setValue('deposit_amount', String(data.deposit_amount || 0));
          setValue('paid_amount', String(totalPaid));
          setValue('balance_amount', String(balance));
          setValue('payment_status', computeStatus(total, totalPaid));
          setValue('amount', String(Math.max(balance, 0)));
          setValue(
            'payment_date',
            new Date().toISOString().slice(0, 10)
          );
        });
    
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
    
          const rentalId = Number(rentalSelect.value);
          const total = Number(getValue('total_amount') || 0);
          const totalPaid = Number(getValue('paid_amount') || 0);
          const paymentAmount = Number(getValue('amount') || 0);
          const paymentDate = getValue('payment_date');
    
          if (!rentalId || !paymentDate || paymentAmount <= 0) {
            la.toast(
              'Tanggal dan jumlah pembayaran wajib diisi.',
              'error'
            );
            return;
          }
    
          const rentalStatusResult = await supabase
            .from('rentals')
            .select('rental_status, status')
            .eq('id', rentalId)
            .single();
    
          if (rentalStatusResult.error) {
            la.toast(rentalStatusResult.error.message, 'error');
            return;
          }
    
          if (
            (
              rentalStatusResult.data.rental_status ||
              rentalStatusResult.data.status
            ) === 'Cancelled'
          ) {
            la.toast(
              'Rental yang dibatalkan tidak dapat menerima pembayaran baru.',
              'error'
            );
            return;
          }
    
          const remaining = total - totalPaid;
    
          if (paymentAmount > remaining) {
            la.toast(
              'Jumlah pembayaran tidak boleh melebihi sisa tagihan.',
              'error'
            );
            return;
          }
    
          const { error } = await supabase.rpc(
            'record_rental_payment',
            {
              p_rental_id: rentalId,
              p_payment_date: paymentDate,
              p_amount: paymentAmount,
              p_payment_method:
                document.getElementById('payment_method').value,
              p_payment_type:
                document.getElementById('payment_type').value,
              p_notes: getValue('description')
            }
          );
    
          if (error) {
            la.toast(error.message, 'error');
            return;
          }
    
          la.toast('Pembayaran berhasil dicatat.');
          rentalSelect.value = '';
          setValue('customer_name', '');
          setValue('dress_code', '');
          setValue('dress_name', '');
          setValue('dress_size', '');
          setValue('dress_color', '');
          setValue('rental_date', '');
          setValue('return_due_date', '');
          setValue('total_amount', '');
          setValue('deposit_amount', '');
          setValue('paid_amount', '');
          setValue('balance_amount', '');
          setValue('payment_status', '');
          setValue('amount', '');
          form.reset();
          renderPaymentRows();
        });
    
        renderPaymentRows();
      }
    
        async function initReturnPage() {
        const root = document.querySelector('.main') || document.body;
    
        const pageHtml = `
          <div class="card" style="padding:18px; margin-bottom:18px;">
            <h3>Pengembalian Dress</h3>
            <form id="returnForm">
              <div class="form-grid">
                <div class="field"><label>Nomor Penyewaan</label><select id="rental_id" required></select></div>
                <div class="field"><label>Customer</label><input id="customer_name" readonly></div>
                <div class="field"><label>Kode Dress</label><input id="dress_code" readonly></div>
                <div class="field"><label>Nama Dress</label><input id="dress_name" readonly></div>
                <div class="field"><label>Ukuran</label><input id="return_dress_size" readonly></div>
                <div class="field"><label>Warna</label><input id="return_dress_color" readonly></div>
                <div class="field"><label>Unit Fisik</label><input id="return_dress_unit" readonly></div>
                <div class="field"><label>Tanggal Sewa</label><input id="rental_date" readonly></div>
                <div class="field"><label>Jatuh Tempo</label><input id="return_due_date" readonly></div>
                <div class="field"><label>Total Sewa</label><input id="return_total_amount" readonly></div>
                <div class="field"><label>Deposit Awal</label><input id="return_deposit_amount" readonly></div>
                <div class="field"><label>Status Pembayaran</label><input id="return_payment_status" readonly></div>
                <div class="field"><label>Tanggal Aktual Pengembalian</label><input id="return_date" type="date" required></div>
                <div class="field"><label>Kondisi Dress</label><select id="condition"><option value="Baik">Baik</option><option value="Kotor">Kotor</option><option value="Rusak Ringan">Rusak Ringan</option><option value="Rusak Berat">Rusak Berat</option><option value="Hilang">Hilang</option></select></div>
                <div class="field"><label>Tarif Denda per Hari</label><input id="late_rate" type="number" min="0" value="50000"></div>
                <div class="field"><label>Hari Keterlambatan</label><input id="late_days" type="number" readonly value="0"></div>
                <div class="field"><label>Denda Keterlambatan</label><input id="late_penalty" type="number" readonly value="0"></div>
                <div class="field"><label>Biaya Kerusakan</label><input id="damage_amount" type="number" min="0" value="0"></div>
                <div class="field"><label>Total Denda</label><input id="total_penalty" type="number" readonly value="0"></div>
                <div class="field"><label>Dibayar Saat Pengembalian</label><input id="penalty_payment_amount" type="number" min="0" value="0"></div>
                <div class="field"><label>Metode Pembayaran Denda</label><select id="penalty_payment_method"><option>Cash</option><option>Transfer</option><option>E-Wallet</option></select></div>
                <div class="field"><label>Catatan</label><input id="notes"></div>
              </div>
              <div class="deposit-summary" id="returnDepositSummary" hidden></div>
              <div class="form-actions"><button type="submit" class="btn btn-primary">Simpan Pengembalian</button></div>
            </form>
          </div>
        `;
    
        root.insertAdjacentHTML('beforeend', pageHtml);
    
        const rentalSelect = document.getElementById('rental_id');
        const form = document.getElementById('returnForm');
        const returnRows = document.getElementById('tbody');
        let currentDeposit = 0;

        const returnHeader = returnRows.closest('table')?.querySelector('thead tr');
        if (returnHeader) {
          returnHeader.innerHTML =
            '<th>Kode Pengembalian</th><th>Rental</th><th>Customer</th><th>Tanggal</th><th>Kondisi</th><th>Hari Terlambat</th><th>Total Denda</th><th>Status Denda</th>';
        }

        async function renderReturns() {
          const result = await supabase
            .from('returns')
            .select('*, rentals(rental_code, customers(name))')
            .order('return_date', {ascending: false})
            .order('id', {ascending: false});

          if (result.error) {
            la.handleSupabaseError(result.error, {module: 'Return', operation: 'LIST'});
            la.toast(result.error.message, 'error');
            return;
          }

          returnRows.innerHTML = (result.data || []).length
            ? result.data.map(item => `
                <tr>
                  <td>${la.escape(item.return_code || '-')}</td>
                  <td>${la.escape(item.rentals?.rental_code || item.rental_id)}</td>
                  <td>${la.escape(item.rentals?.customers?.name || '-')}</td>
                  <td>${la.formatDate(item.return_date)}</td>
                  <td>${la.escape(item.condition || '-')}</td>
                  <td>${la.escape(item.late_days || 0)}</td>
                  <td>${money(item.total_penalty || 0)}</td>
                  <td>${statusBadge(item.penalty_payment_status || 'Paid')}</td>
                </tr>
              `).join('')
            : '<tr><td colspan="8" class="empty">Belum ada data pengembalian.</td></tr>';
        }

        async function loadEligibleRentals() {
          const rentalResult = await supabase
            .from('rentals')
            .select('*, customers(name), returns(id)')
            .order('id', {ascending: false});

          if (rentalResult.error) throw rentalResult.error;

          const rentals = (rentalResult.data || []).filter(
            rental =>
              !(rental.returns || []).length &&
              !['Cancelled', 'Completed', 'Returned'].includes(
                rental.rental_status || rental.status
              )
          );

          rentalSelect.innerHTML =
            '<option value="">Pilih nomor penyewaan</option>' +
            rentals.map(rental =>
              `<option value="${rental.id}">${la.escape(rental.rental_code)} - ${la.escape(rental.customers?.name || '-')}</option>`
            ).join('');
        }
    
        await Promise.all([loadEligibleRentals(), renderReturns()]);
    
        rentalSelect.addEventListener('change', async () => {
          const rentalId = Number(rentalSelect.value);
          if (!rentalId) return;
    
          const { data, error } = await supabase
            .from('rentals')
            .select(
              '*, customers(name), rental_details(*, dresses(dress_code,name), dress_variants(size,color), dress_units(unit_code,status))'
            )
            .eq('id', rentalId)
            .single();
    
          if (error) {
            la.toast(error.message, 'error');
            return;
          }
    
          const detail = (data.rental_details || [])[0] || {};
          const dress = detail.dresses || {};
    
          setValue(
            'customer_name',
            data.customers ? data.customers.name : ''
          );
          setValue('dress_code', dress.dress_code || '');
          setValue('dress_name', dress.name || '');
          setValue('return_dress_size', detail.dress_variants?.size || '');
          setValue('return_dress_color', detail.dress_variants?.color || '');
          setValue(
            'return_dress_unit',
            `${detail.dress_units?.unit_code || ''} / ${detail.dress_units?.status || ''}`
          );
          setValue('rental_date', data.rental_date || '');
          setValue('return_due_date', data.return_due_date || '');
          setValue(
            'return_total_amount',
            data.total_rental ?? data.total_amount ?? 0
          );
    
          currentDeposit = Number(data.deposit_received_amount || 0);
    
          setValue('return_deposit_amount', currentDeposit);
          setValue(
            'return_payment_status',
            data.payment_status || data.status || ''
          );
          setValue(
            'return_date',
            new Date().toISOString().slice(0, 10)
          );
    
          document.getElementById('returnDepositSummary').hidden = false;
          updateReturnTotals();
        });
    
        function updateReturnTotals() {
          const actual = getValue('return_date');
          const due = getValue('return_due_date');
    
          const lateDays =
            actual && due
              ? Math.max(
                  0,
                  Math.ceil(
                    (new Date(actual) - new Date(due)) / 86400000
                  )
                )
              : 0;
    
          const lateAmount =
            lateDays * Number(getValue('late_rate') || 0);
    
          const total =
            lateAmount + Number(getValue('damage_amount') || 0);
    
          setValue('late_days', lateDays);
          setValue('late_penalty', lateAmount);
          setValue('total_penalty', total);
    
          const depositUsed = Math.min(currentDeposit, total);
          const depositRefunded = Math.max(currentDeposit - total, 0);
          const customerDue = Math.max(total - depositUsed, 0);
          const paymentInput =
            document.getElementById('penalty_payment_amount');
    
          paymentInput.max = String(customerDue);
    
          if (Number(paymentInput.value || 0) > customerDue) {
            paymentInput.value = String(customerDue);
          }
    
          const receivable = Math.max(
            customerDue - Number(paymentInput.value || 0),
            0
          );
    
          document.getElementById('returnDepositSummary').innerHTML = `
            <h4>Ringkasan Deposit</h4>
            <div>Deposit Awal<strong>${money(currentDeposit)}</strong></div>
            <div>Denda Keterlambatan<strong>${money(lateAmount)}</strong></div>
            <div>Biaya Kerusakan<strong>${money(Number(getValue('damage_amount') || 0))}</strong></div>
            <div>Total Denda/Kerusakan<strong>${money(total)}</strong></div>
            <div>Deposit Digunakan<strong>${money(depositUsed)}</strong></div>
            <div>Deposit Dikembalikan<strong>${money(depositRefunded)}</strong></div>
            <div>Dibayar Saat Pengembalian<strong>${money(Number(paymentInput.value || 0))}</strong></div>
            <div>Sisa Tagihan<strong>${money(receivable)}</strong></div>`;
        }
    
        [
          'return_date',
          'late_rate',
          'damage_amount',
          'penalty_payment_amount'
        ].forEach(id =>
          document
            .getElementById(id)
            .addEventListener('input', updateReturnTotals)
        );
    
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
    
          const rentalId = Number(rentalSelect.value);
          const actualDate = getValue('return_date');
          const dueDate = getValue('return_due_date');
          const condition = document.getElementById('condition').value;
          const lateRate = Number(getValue('late_rate') || 0);
          const damageAmount = Number(getValue('damage_amount') || 0);
          const paymentAmount = Number(
            getValue('penalty_payment_amount') || 0
          );
    
          if (!rentalId || !actualDate || !dueDate) {
            la.toast(
              'Nomor penyewaan dan tanggal pengembalian wajib diisi.',
              'error'
            );
            return;
          }
    
          const { data: processed, error: returnError } =
            await supabase.rpc('process_return_transaction', {
              p_rental_id: rentalId,
              p_return_date: actualDate,
              p_condition: condition,
              p_notes: getValue('notes') || null,
              p_late_rate: lateRate,
              p_damage_amount: damageAmount,
              p_payment_amount: paymentAmount,
              p_payment_method: getValue('penalty_payment_method')
            });
    
          if (returnError) {
            la.handleSupabaseError(returnError, {
              module: 'Return',
              operation: 'PROCESS'
            });
            la.toast(returnError.message, 'error');
            return;
          }
    
          la.toast('Pengembalian dress berhasil dicatat.');
          form.reset();
          rentalSelect.value = '';
          currentDeposit = 0;
          document.getElementById('returnDepositSummary').hidden = true;
          setValue('late_rate', 50000);
          setValue('late_days', 0);
          setValue('late_penalty', 0);
          setValue('total_penalty', 0);
          setValue('penalty_payment_amount', 0);
          await Promise.all([loadEligibleRentals(), renderReturns()]);
        });
      }
    
      async function initDashboardPage() {
        const now = new Date();
        const hour = now.getHours();
        const greeting = hour < 11
          ? 'Selamat pagi!'
          : hour < 15
            ? 'Selamat siang!'
            : hour < 18
              ? 'Selamat sore!'
              : 'Selamat malam!';
        const greetingElement = document.getElementById('dashboardGreeting');
        const dateElement = document.getElementById('dashboardDate');
        if (greetingElement) greetingElement.textContent = greeting;
        if (dateElement) {
          dateElement.textContent = new Intl.DateTimeFormat('id-ID', {
            dateStyle: 'full'
          }).format(now);
        }

        const revenueEl = document.getElementById('rev');
        const expenseEl = document.getElementById('exp');
        const netEl = document.getElementById('profit');
        const payEl = document.getElementById('ar');
        const availEl = document.getElementById('avail');
        const rentedEl = document.getElementById('rented');
        const statusEl = document.getElementById('status');
    
        if (!revenueEl && !expenseEl && !netEl) return;
    
        const [
          rentalsRes,
          expensesRes,
          dressesRes,
          paymentsRes
        ] = await Promise.all([
          supabase
            .from('rentals')
            .select('id, total_amount, total_rental'),
          supabase
            .from('expenses')
            .select('amount'),
          supabase
            .from('v_dress_inventory')
            .select(
              'status,quantity,available_quantity,rented_quantity,laundry_quantity,repair_quantity,not_available_quantity,unclassified_quantity'
            ),
          supabase
            .from('payments')
            .select('rental_id, amount, payment_type')
        ]);
    
        const revenue = (rentalsRes.data || []).reduce(
          (sum, r) => sum + Number(r.total_amount || 0),
          0
        );
    
        const expense = (expensesRes.data || []).reduce(
          (sum, e) => sum + Number(e.amount || 0),
          0
        );
    
        const paidByRental = {};
    
        (paymentsRes.data || []).forEach(payment => {
          const paid =
            payment.payment_type === 'REFUND'
              ? -Number(payment.amount || 0)
              : ['DP', 'PELUNASAN'].includes(payment.payment_type)
                ? Number(payment.amount || 0)
                : 0;
    
          paidByRental[payment.rental_id] =
            (paidByRental[payment.rental_id] || 0) + paid;
        });
    
        const receivable = (rentalsRes.data || []).reduce(
          (sum, rental) =>
            sum +
            Math.max(
              Number(
                rental.total_rental ?? rental.total_amount ?? 0
              ) - (paidByRental[rental.id] || 0),
              0
            ),
          0
        );
    
        const dresses = dressesRes.data || [];
    
        const dressCounts = dresses.reduce(
          (counts, variant) => {
            counts.Available += Number(
              variant.available_quantity || 0
            );
            counts.Rented += Number(variant.rented_quantity || 0);
            counts.Laundry += Number(variant.laundry_quantity || 0);
            counts.Repair += Number(variant.repair_quantity || 0);
            counts['Not Available'] += Number(
              variant.not_available_quantity || 0
            );
            counts.Unclassified += Number(
              variant.unclassified_quantity || 0
            );
            return counts;
          },
          {
            Available: 0,
            Rented: 0,
            Laundry: 0,
            Repair: 0,
            'Not Available': 0,
            Unclassified: 0
          }
        );
    
        if (revenueEl) revenueEl.textContent = money(revenue);
        if (expenseEl) expenseEl.textContent = money(expense);
        if (netEl) netEl.textContent = money(revenue - expense);
        if (payEl) payEl.textContent = money(receivable);
        if (availEl) {
          availEl.textContent = String(dressCounts.Available || 0);
        }
        if (rentedEl) {
          rentedEl.textContent = String(dressCounts.Rented || 0);
        }
    
        if (statusEl) {
          statusEl.innerHTML = Object.entries(dressCounts)
            .map(
              ([key, val]) =>
                `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>${key}</span><strong>${val}</strong></div>`
            )
            .join('');
        }
      }
    
      async function initLaporanPage() {
        const root = document.querySelector('.main') || document.body;
        const legacyPage = root.querySelector('.page');
        if (legacyPage) legacyPage.remove();
    
        root.insertAdjacentHTML('beforeend', `
          <section class="page" id="operationalReportPage">
            <div class="page-title"><div><h2>Laporan Keuangan</h2><p>Rekap transaksi penyewaan, pembayaran, biaya, pembelian, utang, piutang, persediaan, dan modal.</p></div><button class="btn btn-light" type="button" onclick="window.print()">Cetak / PDF</button></div>
            <div class="card" style="padding:18px;margin-bottom:18px"><div class="form-grid"><div class="field"><label>Dari Tanggal</label><input id="reportFrom" type="date" required></div><div class="field"><label>Sampai Tanggal</label><input id="reportTo" type="date" required></div><div class="field"><label>Periode</label><select id="reportPreset"><option value="custom">Pilih periode</option><option value="today">Hari Ini</option><option value="month">Bulan Ini</option><option value="lastMonth">Bulan Lalu</option><option value="year">Tahun Ini</option><option value="lastYear">Tahun Lalu</option></select></div><div class="field"><label>&nbsp;</label><button class="btn btn-primary" id="refreshReports" type="button">Tampilkan Rekap</button></div></div></div>
            <div class="grid grid-3" id="reportSummary"></div>
            <h3 style="margin-top:22px">Saldo per Akhir Periode</h3>
            <div class="grid grid-3" id="reportBalances"></div>
            <h3 style="margin-top:22px">Laporan Tambahan</h3>
            <div class="grid grid-2" style="align-items:start">
              <div class="card table-card">
                <div class="table-head"><strong>Laporan Laba Rugi</strong></div>
                <div class="table-wrap"><table><tbody id="reportIncomeStatement"><tr><td class="empty">Memuat laporan...</td></tr></tbody></table></div>
              </div>
              <div class="card table-card">
                <div class="table-head"><strong>Laporan Arus Kas</strong></div>
                <div class="table-wrap"><table><tbody id="reportCashFlow"><tr><td class="empty">Memuat laporan...</td></tr></tbody></table></div>
              </div>
            </div>
            <div class="card table-card" style="margin-top:18px"><div class="table-head"><strong>Ringkasan Penyewaan</strong></div><div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Kode</th><th>Customer</th><th>Status</th><th>Total</th><th>Dibayar</th><th>Sisa Piutang</th></tr></thead><tbody id="reportRentals"></tbody></table></div></div>
            <div class="card table-card" style="margin-top:18px"><div class="table-head"><strong>Rincian Pembayaran Usaha</strong></div><div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Kode</th><th>Kategori</th><th>Penerima</th><th>Status</th><th>Jumlah</th></tr></thead><tbody id="reportExpenses"></tbody></table></div></div>
            <div class="card table-card" style="margin-top:18px"><div class="table-head"><strong>Utang Pembelian ke Supplier per Akhir Periode</strong></div><div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Kode Pembelian</th><th>Supplier</th><th>Total</th><th>Dibayar</th><th>Sisa Utang</th></tr></thead><tbody id="reportPayables"></tbody></table></div></div>
            <div class="card table-card" style="margin-top:18px"><div class="table-head"><strong>Biaya per Kategori</strong></div><div class="table-wrap"><table><thead><tr><th>Kategori</th><th>Jumlah Transaksi</th><th>Total</th></tr></thead><tbody id="reportExpenseCategories"></tbody></table></div></div>
            <div class="card table-card" style="margin-top:18px"><div class="table-head"><strong>Setoran Modal</strong></div><div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Kode</th><th>Pemilik</th><th>Jenis</th><th>Status</th><th>Jumlah</th></tr></thead><tbody id="reportCapital"></tbody></table></div></div>
          </section>
        `);
    
        const fromInput = document.getElementById('reportFrom');
        const toInput = document.getElementById('reportTo');
        const iso = date => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const today = new Date();
        fromInput.value = iso(new Date(today.getFullYear(), today.getMonth(), 1));
        toInput.value = iso(today);
    
        function setPreset(value) {
          const now = new Date();
          let from = new Date(now.getFullYear(), now.getMonth(), 1);
          let to = new Date(now);
          if (value === 'today') from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (value === 'lastMonth') {
            from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            to = new Date(now.getFullYear(), now.getMonth(), 0);
          }
          if (value === 'year') from = new Date(now.getFullYear(), 0, 1);
          if (value === 'lastYear') {
            from = new Date(now.getFullYear() - 1, 0, 1);
            to = new Date(now.getFullYear() - 1, 11, 31);
          }
          if (value !== 'custom') {
            fromInput.value = iso(from);
            toInput.value = iso(to);
          }
        }
    
        document.getElementById('reportPreset').addEventListener('change', event => setPreset(event.target.value));
    
        const renderRows = (id, rows, columns, emptyText) => {
          const body = document.getElementById(id);
          body.innerHTML = rows.length
            ? rows.map(row => `<tr>${columns.map(column => `<td>${column(row)}</td>`).join('')}</tr>`).join('')
            : `<tr><td colspan="${columns.length}" class="empty">${la.escape(emptyText)}</td></tr>`;
        };
    
        async function loadReport() {
          const from = fromInput.value;
          const to = toInput.value;
          if (!from || !to || from > to) {
            la.toast('Periode laporan tidak valid.', 'error');
            return;
          }
    
          const result = await supabase.rpc('get_operational_report', {p_from: from, p_to: to});
          if (result.error) {
            la.handleSupabaseError(result.error, {module: 'OperationalReport', operation: 'SELECT'});
            la.toast(result.error.message, 'error');
            return;
          }
    
          const report = Array.isArray(result.data) ? result.data[0] : result.data;
          if (!report || !report.summary || !report.balances) {
            throw new Error('Respons rekap keuangan dari database tidak lengkap.');
          }
          const summary = report.summary;
          const balances = report.balances;
          const summaryCards = [
            ['Pendapatan Sewa', summary.rental_revenue],
            ['Pendapatan Denda', summary.penalty_revenue],
            ['Total Pendapatan', summary.revenue],
            ['Pembayaran Usaha', summary.expenses],
            ['Laba Operasional', summary.profit],
            ['Pembayaran Diterima', summary.payments_received],
            ['Pembelian Dress', summary.purchases],
            ['Setoran Modal', summary.capital_contributions],
            ['Jumlah Penyewaan', Number(summary.rental_count || 0), true],
            ['Pengembalian', Number(summary.returns || 0), true],
            ['Unit Dress Tersedia', Number(summary.available_units || 0), true],
            ['Refund', summary.refunds]
          ];
          document.getElementById('reportSummary').innerHTML = summaryCards.map(([label, value, count]) =>
            `<div class="card"><div class="muted">${la.escape(label)}</div><h2>${count ? la.escape(value) : money(value)}</h2></div>`
          ).join('');
    
          const balanceCards = [
            ['Piutang Customer', balances.customer_receivables],
            ['Utang Supplier', balances.supplier_payables],
            ['Utang Pembayaran Usaha', balances.expense_payables],
            ['Deposit Customer Tertahan', balances.customer_deposits]
          ];
          document.getElementById('reportBalances').innerHTML = balanceCards.map(([label, value]) =>
            `<div class="card"><div class="muted">${la.escape(label)}</div><h2>${money(value)}</h2></div>`
          ).join('');
    
          renderRows('reportRentals', report.rentals || [], [
            row => la.formatDate(row.rental_date),
            row => la.escape(row.rental_code),
            row => la.escape(row.customer_name || '-'),
            row => la.escape(row.status),
            row => money(row.amount),
            row => money(row.paid_amount),
            row => money(row.remaining_amount)
          ], 'Tidak ada penyewaan pada periode ini.');
          renderRows('reportExpenses', report.expenses || [], [
            row => la.formatDate(row.expense_date),
            row => la.escape(row.expense_code),
            row => la.escape(row.category_name || '-'),
            row => la.escape(row.recipient || '-'),
            row => la.escape(row.payment_status || '-'),
            row => money(row.amount)
          ], 'Tidak ada biaya operasional pada periode ini.');
          renderRows('reportPayables', report.supplier_payables || [], [
            row => la.formatDate(row.purchase_date),
            row => la.escape(row.purchase_code),
            row => la.escape(row.supplier_name || '-'),
            row => money(row.total_amount),
            row => money(row.paid_amount),
            row => money(row.remaining_amount)
          ], 'Tidak ada utang pembelian yang tersisa.');
          renderRows('reportExpenseCategories', report.expense_categories || [], [
            row => la.escape(row.category_name),
            row => la.escape(row.transaction_count),
            row => money(row.amount)
          ], 'Tidak ada biaya untuk diringkas.');
          renderRows('reportCapital', report.capital_contributions || [], [
            row => la.formatDate(row.contribution_date),
            row => la.escape(row.capital_code),
            row => la.escape(row.owner_name),
            row => la.escape(row.contribution_type),
            row => la.escape(row.status),
            row => money(row.amount)
          ], 'Tidak ada setoran modal pada periode ini.');

          const statementResult = await supabase.rpc('get_financial_statement_report', {
            p_from: from,
            p_to: to
          });
          const incomeBody = document.getElementById('reportIncomeStatement');
          const cashFlowBody = document.getElementById('reportCashFlow');
          if (statementResult.error) {
            la.handleSupabaseError(statementResult.error, {
              module: 'FinancialStatement',
              operation: 'SELECT'
            });
            const missingMigration = statementResult.error.code === 'PGRST202';
            const statementMessage = missingMigration
              ? 'Jalankan Migration 41 agar laporan tambahan tersedia.'
              : statementResult.error.message;
            incomeBody.innerHTML = `<tr><td class="empty">${la.escape(statementMessage)}</td></tr>`;
            cashFlowBody.innerHTML = `<tr><td class="empty">${la.escape(statementMessage)}</td></tr>`;
            return;
          }

          const statements = Array.isArray(statementResult.data)
            ? statementResult.data[0]
            : statementResult.data;
          if (!statements?.income_statement || !statements?.cash_flow) {
            throw new Error('Respons laporan laba rugi dan arus kas tidak lengkap.');
          }

          const income = statements.income_statement;
          const incomeRows = [
            ['Pendapatan sewa', income.rental_revenue],
            ['Pendapatan denda', income.penalty_revenue],
            ['Total pendapatan', income.total_revenue, true],
            ['Pembayaran Usaha (beban)', income.operating_expenses],
            ['Laba bersih operasional', income.net_profit, true]
          ];
          incomeBody.innerHTML = incomeRows.map(([label, amount, emphasized]) =>
            `<tr><td>${emphasized ? `<strong>${la.escape(label)}</strong>` : la.escape(label)}</td><td class="text-right">${emphasized ? `<strong>${money(amount)}</strong>` : money(amount)}</td></tr>`
          ).join('') + '<tr><td colspan="2" class="muted">Pembelian dress tidak dihitung sebagai beban laba rugi; nilainya ditampilkan pada arus kas sebagai pembelian persediaan.</td></tr>';

          const cashFlow = statements.cash_flow;
          const cashFlowRows = [
            ['Kas masuk dari pembayaran sewa', cashFlow.rental_receipts],
            ['Kas masuk dari pembayaran denda', cashFlow.penalty_receipts],
            ['Deposit customer diterima', cashFlow.deposits_received],
            ['Setoran modal tunai / transfer', cashFlow.capital_contributions],
            ['Total kas masuk', cashFlow.total_inflows, true],
            ['Refund pembayaran sewa', cashFlow.refunds],
            ['Pembayaran Usaha', cashFlow.expense_payments],
            ['Pembayaran pembelian persediaan', cashFlow.purchase_payments],
            ['Deposit customer dikembalikan', cashFlow.deposits_refunded],
            ['Total kas keluar', cashFlow.total_outflows, true],
            ['Arus kas bersih periode', cashFlow.net_cash_flow, true]
          ];
          cashFlowBody.innerHTML = cashFlowRows.map(([label, amount, emphasized]) =>
            `<tr><td>${emphasized ? `<strong>${la.escape(label)}</strong>` : la.escape(label)}</td><td class="text-right">${emphasized ? `<strong>${money(amount)}</strong>` : money(amount)}</td></tr>`
          ).join('') + '<tr><td colspan="2" class="muted">Arus kas bersih menunjukkan perubahan kas dari transaksi yang tercatat pada periode ini, bukan saldo kas akhir.</td></tr>';
        }
    
        document.getElementById('refreshReports').addEventListener('click', () => {
          loadReport().catch(error => {
            la.handleSupabaseError(error, {module: 'OperationalReport', operation: 'LOAD'});
            la.toast(error.message, 'error');
          });
        });
        await loadReport();
      }
      async function boot() {
        try {
          if (page === 'penyewaan') await initRentalPage();
          if (page === 'pembelian') await initPurchasePage();
          if (page === 'pembayaran-usaha') await initExpensePage();
          if (page === 'pembayaran') await initPaymentPage();
          if (page === 'pengembalian') await initReturnPage();
          if (page === 'dashboard') await initDashboardPage();
          if (page === 'laporan') await initLaporanPage();
    
        } catch (error) {
          console.error(error);
    
          if (window.lave && window.lave.toast) {
            window.lave.toast(
              error.message || 'Terjadi kesalahan.',
              'error'
            );
          }
        }
      }
    
      if (document.readyState === 'loading') {
        document.addEventListener(
          'DOMContentLoaded',
          boot,
          { once: true }
        );
      } else {
        boot();
      }
    })();
  },
  "capital.js": function () {
    (function () {
      const db = window.lave.supabase
      const $ = id => document.getElementById(id)
      const money = value => window.lave.currency(value)
      const esc = value => window.lave.escape(value)
    
      async function render() {
        const result = await db
          .from('v_capital_contributions')
          .select('*')
          .order('id', { ascending: false })
    
        if (result.error) {
          window.lave.handleSupabaseError(result.error, { module: 'Capital', operation: 'SELECT' })
          window.lave.toast(result.error.message, 'error')
          return
        }
    
        const header = $('capitalRows').closest('table')?.querySelector('thead tr')
    
        if (header && !header.querySelector('.capital-action-heading')) {
          header.insertAdjacentHTML(
            'beforeend',
            '<th class="capital-action-heading">Aksi</th>'
          )
        }
    
        $('capitalRows').innerHTML = (result.data || []).length
          ? result.data
              .map(row =>
                `<tr><td>${esc(row.capital_code)}</td><td>${window.lave.formatDate(row.contribution_date)}</td><td>${esc(row.owner_name)}</td><td>${esc(row.contribution_type)}</td><td>${money(row.amount)}</td><td>${esc(row.status)}</td><td>${row.status === 'Posted' ? `<button class="btn btn-danger capital-cancel" data-id="${row.id}">Batalkan</button>` : '-'}</td></tr>`
              )
              .join('')
          : '<tr><td colspan="7" class="empty">Belum ada setoran modal.</td></tr>'
    
        document.querySelectorAll('.capital-cancel').forEach(button =>
          button.addEventListener('click', async () => {
            const reason = window.prompt(
              'Alasan pembatalan setoran modal:',
              'Koreksi transaksi'
            )
    
            if (!reason) return
    
            const cancelResult = await db.rpc('cancel_capital_contribution', {
              p_capital_id: Number(button.dataset.id),
              p_reason: reason
            })
    
            if (cancelResult.error) {
              window.lave.handleSupabaseError(cancelResult.error, {
                module: 'Capital',
                operation: 'CANCEL'
              })
              window.lave.toast(cancelResult.error.message, 'error')
              return
            }
    
            window.lave.toast('Setoran modal berhasil dibatalkan.')
            await render()
          })
        )
      }
    
      $('capitalDate').value = new Date().toISOString().slice(0, 10)
    
      $('capitalForm').addEventListener('submit', async event => {
        event.preventDefault()
    
        const payload = {
          p_contribution_date: $('capitalDate').value,
          p_owner_name: $('ownerName').value.trim(),
          p_contribution_type: $('capitalType').value,
          p_amount: Number($('capitalAmount').value),
          p_description: $('capitalDescription').value.trim() || null
        }
    
        if (
          !payload.p_owner_name ||
          payload.p_amount <= 0
        ) {
          window.lave.toast(
            'Pemilik dan jumlah wajib diisi.',
            'error'
          )
          return
        }
    
        const result = await db.rpc('create_capital_contribution', payload)
    
        if (result.error) {
          window.lave.handleSupabaseError(result.error, {
            module: 'Capital',
            operation: 'INSERT'
          })
          window.lave.toast(result.error.message, 'error')
          return
        }
    
        const capitalRecord = Array.isArray(result.data)
          ? result.data[0]
          : result.data
    
        window.lave.toast(
          `Setoran modal ${capitalRecord.capital_code} berhasil diposting.`
        )
    
        $('capitalForm').reset()
        $('capitalDate').value = new Date().toISOString().slice(0, 10)
        await render()
      })
    
      render().catch(error => {
        window.lave.handleSupabaseError(error, {
          module: 'Capital',
          operation: 'INIT'
        })
        window.lave.toast(error.message, 'error')
      })
    }())
  },
  "master-dress.js": function () {
    (function () {
      const supabase = window.lave.supabase;
      const state = { dresses: [], variants: [], categories: [] };
      const $ = id => document.getElementById(id);
      const value = id => $(id).value;
      const setValue = (id, val) => {
        $(id).value = val ?? '';
      };
      const money = val => window.lave.currency(val);
    
      function open() {
        $('dressModal').classList.add('show');
      }
    
      function close() {
        $('dressModal').classList.remove('show');
      }
    
      function resetForm() {
        $('dressForm').reset();
        setValue('dressId', '');
        setValue('dressCode', '');
        setValue('dressStatus', 'Active');
        setValue('dressCondition', 'Good');
        photoPreview.hidden = true;
        photoPreview.src = '';
        $('dressModalTitle').textContent = 'Tambah Dress';
      }
    
      function render() {
        const query = value('dressSearch').trim().toLowerCase();
        const rows = state.dresses.filter(d =>
          `${d.dress_code} ${d.name}`.toLowerCase().includes(query)
        );
    
        $('dressRows').closest('table').querySelector('thead').innerHTML =
          '<tr><th>Kode Model</th><th>Nama Model</th><th>Kategori</th><th>Jumlah Varian</th><th>Warna Varian</th><th>Harga Beli Dasar</th><th>Harga Sewa</th><th>Status</th><th>Kondisi</th><th>Aksi</th></tr>';
    
        $('dressRows').innerHTML = rows.length
          ? rows.map(d => {
              const variants = state.variants.filter(
                variant => Number(variant.dress_id) === Number(d.id)
              );
    
              const colors = [
                ...new Set(variants.map(variant => variant.color).filter(Boolean))
              ].join(', ') || '-';
              const rentedQuantity = variants.reduce(
                (total, variant) => total + Number(variant.rented_quantity || 0),
                0
              );
              const cannotDisable = d.is_active === false || rentedQuantity > 0;
              const disableTitle = rentedQuantity > 0
                ? 'Dress masih memiliki unit yang sedang disewa.'
                : 'Nonaktifkan dress';
    
              return `<tr><td>${window.lave.escape(d.dress_code)}</td><td><strong>${window.lave.escape(d.name)}</strong></td><td>${window.lave.escape(d.dress_categories?.category_name || '-')}</td><td>${variants.length}</td><td>${window.lave.escape(colors)}</td><td>${money(d.purchase_price)}</td><td>${money(d.rental_price)}</td><td>${d.is_active === false ? 'Inactive' : 'Active'}</td><td>${window.lave.escape(d.condition || '-')}</td><td><button class="btn btn-light" data-variants="${d.id}">Varian</button> <button class="btn btn-light" data-edit="${d.id}">Edit</button> <button class="btn btn-danger" data-disable="${d.id}" title="${disableTitle}" ${cannotDisable ? 'disabled' : ''}>Nonaktifkan</button></td></tr>`;
            }).join('')
          : '<tr><td colspan="10" class="empty">Belum ada data dress.</td></tr>';
    
        document.querySelectorAll('[data-edit]').forEach(btn =>
          btn.addEventListener('click', () => edit(Number(btn.dataset.edit)))
        );
    
        document.querySelectorAll('[data-disable]').forEach(btn =>
          btn.addEventListener('click', () => disable(Number(btn.dataset.disable)))
        );
    
        document.querySelectorAll('[data-variants]').forEach(btn =>
          btn.addEventListener('click', () =>
            manageVariants(Number(btn.dataset.variants))
          )
        );
      }
    
      async function load() {
        const [dressResult, variantResult] = await Promise.all([
          supabase
            .from('dresses')
            .select('*,dress_categories(category_name)')
            .order('dress_code'),
          supabase
            .from('dress_variants')
            .select('*')
            .order('normalized_size')
        ]);
    
        if (dressResult.error) throw dressResult.error;
        if (variantResult.error) throw variantResult.error;
    
        state.dresses = dressResult.data || [];
        state.variants = variantResult.data || [];
        render();
      }
    
      async function loadOptions() {
        const categories = await supabase
          .from('dress_categories')
          .select('*')
          .order('category_name');

        if (categories.error) throw categories.error;

        state.categories = categories.data || [];
    
        $('dressCategory').innerHTML =
          '<option value="">Pilih kategori</option>' +
          state.categories
            .map(c =>
              `<option value="${c.id}">${window.lave.escape(c.category_name)}</option>`
            )
            .join('');
    
      }

      function renderDressCategories() {
        const rows = $('dressCategoryRows');
        if (!rows) return;

        rows.innerHTML = state.categories.length
          ? state.categories.map(category =>
              `<tr><td>${window.lave.escape(category.category_name)}</td><td>${window.lave.escape(category.description || '-')}</td><td><button class="btn btn-light" type="button" data-category-edit="${category.id}">Edit</button> <button class="btn btn-danger" type="button" data-category-delete="${category.id}">Hapus</button></td></tr>`
            ).join('')
          : '<tr><td colspan="3" class="empty">Belum ada kategori dress.</td></tr>';

        rows.querySelectorAll('[data-category-edit]').forEach(button =>
          button.addEventListener('click', () => {
            const category = state.categories.find(
              item => Number(item.id) === Number(button.dataset.categoryEdit)
            );
            if (!category) return;
            setValue('dressCategoryId', category.id);
            setValue('dressCategoryName', category.category_name);
            setValue('dressCategoryDescription', category.description);
            $('dressCategorySaveButton').textContent = 'Simpan Perubahan';
            $('dressCategoryName').focus();
          })
        );

        rows.querySelectorAll('[data-category-delete]').forEach(button =>
          button.addEventListener('click', async () => {
            const category = state.categories.find(
              item => Number(item.id) === Number(button.dataset.categoryDelete)
            );
            if (!category || !confirm(`Hapus kategori "${category.category_name}"? Dress terkait akan menjadi tanpa kategori.`)) return;

            const {error} = await supabase
              .from('dress_categories')
              .delete()
              .eq('id', category.id);

            if (error) {
              window.lave.handleSupabaseError(error, {module: 'DressCategory', operation: 'DELETE'});
              window.lave.toast(error.message, 'error');
              return;
            }

            window.lave.toast('Kategori dress berhasil dihapus.');
            await loadOptions();
            await load();
            renderDressCategories();
          })
        );
      }

      let resetDressCategoryForm = () => {};

      function openDressCategoryManager() {
        let modal = $('dressCategoryManagerModal');
        if (!modal) {
          document.body.insertAdjacentHTML('beforeend', `
            <div class="modal" id="dressCategoryManagerModal">
              <div class="modal-box">
                <div class="modal-head">
                  <h3>Kelola Kategori Dress</h3>
                  <button class="close" type="button" id="closeDressCategoryManager">×</button>
                </div>
                <form id="dressCategoryForm">
                  <input type="hidden" id="dressCategoryId">
                  <div class="form-grid">
                    <div class="field"><label>Nama Kategori</label><input id="dressCategoryName" maxlength="100" required></div>
                    <div class="field"><label>Deskripsi</label><input id="dressCategoryDescription" maxlength="250"></div>
                  </div>
                  <div class="form-actions">
                    <button class="btn btn-light" id="dressCategoryCancelButton" type="button">Batal</button>
                    <button class="btn btn-primary" id="dressCategorySaveButton" type="submit">Tambah Kategori</button>
                  </div>
                </form>
                <div class="table-wrap" style="margin-top:18px">
                  <table><thead><tr><th>Kategori</th><th>Deskripsi</th><th>Aksi</th></tr></thead><tbody id="dressCategoryRows"></tbody></table>
                </div>
              </div>
            </div>
          `);

          modal = $('dressCategoryManagerModal');
          const form = $('dressCategoryForm');
          resetDressCategoryForm = () => {
            form.reset();
            setValue('dressCategoryId', '');
            $('dressCategorySaveButton').textContent = 'Tambah Kategori';
          };

          $('closeDressCategoryManager').addEventListener('click', () => modal.classList.remove('show'));
          $('dressCategoryCancelButton').addEventListener('click', resetDressCategoryForm);
          form.addEventListener('submit', async event => {
            event.preventDefault();
            const name = value('dressCategoryName').trim();
            if (!name) {
              window.lave.toast('Nama kategori wajib diisi.', 'error');
              return;
            }

            const id = value('dressCategoryId');
            const payload = {
              category_name: name,
              description: value('dressCategoryDescription').trim() || null
            };
            const result = id
              ? await supabase.from('dress_categories').update(payload).eq('id', id)
              : await supabase.from('dress_categories').insert(payload);

            if (result.error) {
              window.lave.handleSupabaseError(result.error, {
                module: 'DressCategory',
                operation: id ? 'UPDATE' : 'INSERT'
              });
              window.lave.toast(result.error.message, 'error');
              return;
            }

            window.lave.toast(id ? 'Kategori dress berhasil diperbarui.' : 'Kategori dress berhasil ditambahkan.');
            resetDressCategoryForm();
            await loadOptions();
            await load();
            renderDressCategories();
          });
        }

        resetDressCategoryForm();
        renderDressCategories();
        modal.classList.add('show');
      }
    
      async function edit(id) {
        const d = state.dresses.find(item => item.id === id);
        if (!d) return;
    
        setValue('dressId', d.id);
        setValue('dressCode', d.dress_code);
        setValue('dressName', d.name);
        setValue('dressCategory', d.category_id);
        setValue('dressSize', '');
        setValue('dressPurchasePrice', d.purchase_price);
        setValue('dressRentalPrice', d.rental_price);
        setValue('dressCondition', d.condition || 'Good');
        setValue('dressStatus', d.is_active === false ? 'Inactive' : 'Active');
        setValue('dressDescription', d.description);
        photoPreview.src = d.photo_url || '';
        photoPreview.hidden = !d.photo_url;
        $('dressModalTitle').textContent = 'Edit Model Dress';
        open();
      }
    
      async function manageVariants(dressId) {
        const dress = state.dresses.find(item => Number(item.id) === dressId);
        if (!dress) return;
    
        let modal = $('variantManagerModal');
    
        if (!modal) {
          document.body.insertAdjacentHTML(
            'beforeend',
            '<div class="modal" id="variantManagerModal"><div class="modal-box"><div class="modal-head"><h3>Varian Dress</h3><button class="close" type="button" id="closeVariantManager">×</button></div><p id="variantManagerModel"></p><form id="variantForm"><div class="form-grid"><div class="field"><label>Ukuran</label><input id="variantSize" list="variantSizeOptions" required maxlength="20"><datalist id="variantSizeOptions"><option value="XS"><option value="S"><option value="M"><option value="L"><option value="XL"><option value="XXL"></datalist></div><div class="field"><label>Warna</label><input id="variantColor" required maxlength="50"></div></div><p class="muted">Stok masuk dicatat melalui Pembelian dan riwayat persediaan.</p><div class="form-actions"><button type="submit" class="btn btn-primary">Tambah Varian</button></div></form><div class="table-wrap"><table><thead><tr><th>Ukuran</th><th>Warna</th><th>Stok</th><th>Tersedia</th><th>Disewa</th><th>Laundry</th><th>Repair</th><th>Status</th><th>Kondisi</th></tr></thead><tbody id="variantRows"></tbody></table></div></div></div>'
          );
    
          modal = $('variantManagerModal');
    
          $('closeVariantManager').addEventListener(
            'click',
            () => modal.classList.remove('show')
          );
    
          $('variantForm').addEventListener('submit', async event => {
            event.preventDefault();
    
            const size = $('variantSize').value.trim().toUpperCase();
            const color = $('variantColor').value.trim();
    
            if (!size || !color) {
              window.lave.toast('Ukuran dan warna wajib diisi.', 'error');
              return;
            }
    
            const { error } = await supabase.rpc('ensure_dress_variant', {
              p_dress_id: Number(modal.dataset.dressId),
              p_size: size,
              p_color: color
            });
    
            if (error) {
              window.lave.toast(error.message, 'error');
              return;
            }
    
            $('variantSize').value = '';
            $('variantColor').value = '';
            await load();
            renderVariantRows(Number(modal.dataset.dressId));
            window.lave.toast(
              'Varian ukuran dan warna tersimpan. Stok dapat ditambahkan melalui Pembelian.'
            );
          });
        }
    
        modal.dataset.dressId = String(dressId);
        $('variantManagerModel').textContent =
          `${dress.dress_code} - ${dress.name}`;
        renderVariantRows(dressId);
        modal.classList.add('show');
      }
    
      function renderVariantRows(dressId) {
        const variants = state.variants.filter(
          variant => Number(variant.dress_id) === dressId
        );
    
        $('variantRows').innerHTML = variants.length
          ? variants
              .map(
                variant =>
                  `<tr><td>${window.lave.escape(variant.size)}</td><td>${window.lave.escape(variant.color)}</td><td>${variant.quantity}</td><td>${variant.available_quantity}</td><td>${variant.rented_quantity}</td><td>${variant.laundry_quantity || 0}</td><td>${variant.repair_quantity || 0}</td><td>${window.lave.escape(variant.status)}</td><td>${window.lave.escape(variant.condition)}</td></tr>`
              )
              .join('')
          : '<tr><td colspan="9" class="empty">Belum ada varian.</td></tr>';
      }
    
      async function disable(id) {
        const variantResult = await supabase
          .from('dress_variants')
          .select('rented_quantity')
          .eq('dress_id', id);

        if (variantResult.error) {
          window.lave.handleSupabaseError(variantResult.error, {
            module: 'Dress',
            operation: 'CHECK_ACTIVE_RENTALS'
          });
          window.lave.toast(variantResult.error.message, 'error');
          return;
        }

        const rentedQuantity = (variantResult.data || []).reduce(
          (total, variant) => total + Number(variant.rented_quantity || 0),
          0
        );

        if (rentedQuantity > 0) {
          window.lave.toast(
            'Dress belum dapat dinonaktifkan karena masih ada unit yang sedang disewa.',
            'error'
          );
          await load();
          return;
        }

        if (!confirm('Nonaktifkan dress ini? Data transaksi tetap dipertahankan.')) {
          return;
        }

        const { error } = await supabase
          .from('dresses')
          .update({ is_active: false, status: 'Not Available' })
          .eq('id', id);

        if (error) {
          window.lave.handleSupabaseError(error, {
            module: 'Dress',
            operation: 'DEACTIVATE'
          });
          window.lave.toast(error.message, 'error');
          return;
        }
    
        window.lave.toast('Dress dinonaktifkan.');
        await load();
      }
    
      $('addDressButton').addEventListener('click', () => {
        resetForm();
        open();
      });
      $('manageDressCategoriesButton').addEventListener('click', openDressCategoryManager);
    
      $('dressSize').required = false;
      $('dressSize').disabled = true;
      $('dressSize').closest('.field').hidden = true;
    
      $('dressStatus')
        .closest('.field')
        .querySelector('label').textContent = 'Status Aktif';
    
      $('dressStatus').innerHTML =
        '<option value="Active">Active</option><option value="Inactive">Inactive</option>';
    
      $('dressStatus').value = 'Active';
    
      $('dressColor').closest('.field').hidden = true;
      $('dressColor').required = false;
    
      $('dressPhoto').type = 'file';
      $('dressPhoto').accept = 'image/*';
    
      $('dressPhoto')
        .closest('.field')
        .querySelector('label').textContent = 'Foto Dress (maks. 5 MB)';
    
      const photoPreview = document.createElement('img');
      photoPreview.alt = 'Pratinjau foto dress';
      photoPreview.hidden = true;
      photoPreview.style.maxWidth = '160px';
      photoPreview.style.maxHeight = '180px';
      photoPreview.style.objectFit = 'cover';
    
      $('dressPhoto').after(photoPreview);
    
      $('dressPhoto').addEventListener('change', () => {
        const file = $('dressPhoto').files?.[0];
        photoPreview.hidden = !file;
        if (file) photoPreview.src = URL.createObjectURL(file);
      });
    
      document
        .querySelectorAll('[data-close="dressModal"]')
        .forEach(btn => btn.addEventListener('click', close));
    
      $('dressSearch').addEventListener('input', render);
    
      $('dressForm').addEventListener('submit', async event => {
        event.preventDefault();
    
        const id = value('dressId');
        const isActive = value('dressStatus') === 'Active';
    
        const fields = {
          name: value('dressName'),
          category_id: value('dressCategory'),
          purchase_price: value('dressPurchasePrice'),
          rental_price: value('dressRentalPrice'),
          condition: value('dressCondition'),
          description: value('dressDescription')
        };
    
        const built = window.lave.buildDressMasterPayload(fields);
    
        if (built.error) {
          window.lave.toast(built.error, 'error');
          return;
        }
    
        if (isActive) {
          const duplicate = state.dresses.find(
            dress =>
              Number(dress.id) !== Number(id) &&
              dress.is_active !== false &&
              dress.name.trim().toLowerCase() ===
                built.payload.name.toLowerCase() &&
              Number(dress.category_id) === built.payload.category_id
          );
    
          if (duplicate) {
            window.lave.toast(
              `Model serupa sudah terdaftar dengan kode ${duplicate.dress_code}. Tambahkan varian pada model tersebut.`,
              'error'
            );
            return;
          }
        }
    
        const photoFile = $('dressPhoto').files?.[0];
    
        if (id) {
          const result = await window.lave.updateDress(
            id,
            fields,
            photoFile,
            { is_active: isActive }
          );
    
          if (result.error) {
            window.lave.toast(result.error.message, 'error');
            return;
          }
    
          window.lave.toast('Data dress berhasil diperbarui.');
        } else {
          const photo = await window.lave.uploadDressPhoto(photoFile, null);
    
          if (photo.error) {
            window.lave.toast(photo.error, 'error');
            return;
          }
    
          const payload = {
            ...built.payload,
            photo_url: photo.photo_url,
            is_active: isActive,
            status: isActive ? 'Available' : 'Not Available'
          };
    
          const result = await supabase.from('dresses').insert(payload);
    
          if (result.error) {
            if (photo.uploadedPath) {
              await supabase.storage
                .from('dress-photos')
                .remove([photo.uploadedPath]);
            }
    
            window.lave.toast(result.error.message, 'error');
            return;
          }
    
          window.lave.toast(
            'Model dress dibuat dengan kode sequence database.'
          );
        }
    
        $('dressForm').reset();
        photoPreview.hidden = true;
        close();
        await load();
      });
    
      Promise.all([loadOptions(), load()]).catch(error =>
        window.lave.toast(error.message, 'error')
      );
    }());
  },
  "inventory.js": function () {
    (function () {
      const supabase = window.lave.supabase;
      const esc = window.lave.escape;
      let dresses = [];
      let units = [];
      const money = value => window.lave.currency(value);
    
      const statusBadge = status => {
        const label = String(status || '-');
        const key = label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
    
        return `<span class="badge status-${key}">${esc(label)}</span>`;
      };
    
      function render() {
        const query = document
          .getElementById('inventorySearch')
          .value
          .trim()
          .toLowerCase();
    
        const status = document.getElementById('inventoryStatus').value;
    
        const rows = dresses.filter(
          d =>
            (!status || d.status === status) &&
            `${d.dress_code} ${d.name} ${d.size} ${d.color}`
              .toLowerCase()
              .includes(query)
        );
    
        const inventoryBody = document.getElementById('inventoryRows');
    
        inventoryBody.closest('table').querySelector('thead').innerHTML =
          '<tr><th>Kode</th><th>Nama Model</th><th>Ukuran</th><th>Warna</th><th>Total</th><th>Tersedia</th><th>Disewa</th><th>Laundry</th><th>Repair</th><th>Tidak tersedia</th><th>Status</th><th>Kondisi</th><th>Aksi</th></tr>';
    
        inventoryBody.innerHTML = rows.length
          ? rows
              .map(
                d =>
                  `<tr><td>${esc(d.dress_code)}</td><td>${esc(d.name)}</td><td>${esc(d.size)}</td><td class="${d.color === 'UNVERIFIED' ? 'variant-color-unverified' : ''}">${esc(d.color)}</td><td>${d.quantity}</td><td>${d.available_quantity}</td><td>${d.rented_quantity}</td><td>${d.laundry_quantity || 0}</td><td>${d.repair_quantity || 0}</td><td>${Number(d.not_available_quantity || 0) + Number(d.unclassified_quantity || 0)}</td><td>${statusBadge(d.status)}</td><td>${esc(d.condition || '-')}</td><td><div class="variant-actions"><button type="button" class="btn btn-light" data-detail-variant="${d.dress_variant_id}">Detail Unit</button><button type="button" class="btn btn-light" data-edit-status="${d.dress_variant_id}">Pilih Unit</button>${d.color === 'UNVERIFIED' ? `<button type="button" class="btn btn-light" data-reconcile-color="${d.dress_variant_id}">Stocktake Warna</button>` : ''}</div></td></tr>`
              )
              .join('')
          : '<tr><td colspan="13" class="empty">Tidak ada dress sesuai filter.</td></tr>';
    
        inventoryBody
          .querySelectorAll('[data-detail-variant]')
          .forEach(button =>
            button.addEventListener('click', () =>
              openDetail(Number(button.dataset.detailVariant))
            )
          );
    
        inventoryBody
          .querySelectorAll('[data-edit-status]')
          .forEach(button =>
            button.addEventListener('click', () =>
              openDetail(Number(button.dataset.editStatus))
            )
          );
    
        inventoryBody
          .querySelectorAll('[data-reconcile-color]')
          .forEach(button =>
            button.addEventListener('click', () =>
              openColorReconciliation(Number(button.dataset.reconcileColor))
            )
          );
      }
    
      async function openDetail(variantId) {
        const variant = dresses.find(
          item => Number(item.dress_variant_id) === variantId
        );
    
        if (!variant) return;
    
        const unitResult = await supabase
          .from('dress_units')
          .select('id,variant_id,unit_code,status,condition,notes')
          .eq('variant_id', variantId)
          .order('unit_code');
    
        if (unitResult.error) {
          window.lave.toast(unitResult.error.message, 'error');
          return;
        }
    
        units = unitResult.data || [];
    
        let modal = document.getElementById('inventoryDetailModal');
    
        if (!modal) {
          document.body.insertAdjacentHTML(
            'beforeend',
            '<div class="modal" id="inventoryDetailModal"><div class="modal-box"><div class="modal-head"><h3>Detail Varian dan Unit</h3><button type="button" class="close" id="closeInventoryDetail">×</button></div><div id="inventoryDetailContent" class="form-grid"></div><div class="table-wrap"><table><thead><tr><th>Unit</th><th>Status</th><th>Kondisi</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody id="inventoryUnitRows"></tbody></table></div></div></div>'
          );
    
          modal = document.getElementById('inventoryDetailModal');
    
          document
            .getElementById('closeInventoryDetail')
            .addEventListener('click', () => modal.classList.remove('show'));
        }
    
        document.getElementById('inventoryDetailContent').innerHTML = `
          <div class="field"><label>Model</label><input readonly value="${esc(`${variant.dress_code} - ${variant.name}`)}"></div>
          <div class="field"><label>Ukuran / Warna</label><input readonly value="${esc(`${variant.size} / ${variant.color}`)}"></div>
          <div class="field"><label>Status</label><input readonly value="${esc(variant.status)}"></div>
          <div class="field"><label>Kondisi</label><input readonly value="${esc(variant.condition)}"></div>
          <div class="field"><label>Total</label><input readonly value="${variant.quantity}"></div>
          <div class="field"><label>Tersedia / Disewa</label><input readonly value="${variant.available_quantity} / ${variant.rented_quantity}"></div>
          <div class="field"><label>Laundry / Repair</label><input readonly value="${variant.laundry_quantity || 0} / ${variant.repair_quantity || 0}"></div>
          <div class="field"><label>Tidak tersedia / Belum terklasifikasi</label><input readonly value="${variant.not_available_quantity || 0} / ${variant.unclassified_quantity || 0}"></div>`;
    
        document.getElementById('inventoryUnitRows').innerHTML = units.length
          ? units
              .map(
                unit =>
                  `<tr><td>${esc(unit.unit_code)}</td><td>${statusBadge(unit.status)}</td><td>${esc(unit.condition || '-')}</td><td>${esc(unit.notes || '-')}</td><td>${unit.status === 'Repair' ? `<button type="button" class="btn btn-primary" data-complete-repair="${unit.id}">Selesai Repair</button> ` : ''}<button type="button" class="btn btn-light" data-edit-unit="${unit.id}" ${unit.status === 'Rented' ? 'disabled' : ''}>Edit Status</button></td></tr>`
              )
              .join('')
          : '<tr><td colspan="5" class="empty">Belum ada unit fisik.</td></tr>';
    
        document
          .getElementById('inventoryUnitRows')
          .querySelectorAll('[data-edit-unit]')
          .forEach(button =>
            button.addEventListener('click', () =>
              openStatusEditor(Number(button.dataset.editUnit))
            )
          );

        document
          .getElementById('inventoryUnitRows')
          .querySelectorAll('[data-complete-repair]')
          .forEach(button =>
            button.addEventListener('click', () =>
              openStatusEditor(Number(button.dataset.completeRepair), true)
            )
          );
    
        modal.dataset.variantId = String(variantId);
        modal.classList.add('show');
      }
     
      function openStatusEditor(unitId, completeRepair = false) {
        const unit = units.find(item => Number(item.id) === unitId);
        if (!unit) return;
    
        const parentVariant = dresses.find(
          item =>
            item.dress_variant_id ===
            Number(document.getElementById('inventoryDetailModal')?.dataset.variantId)
        );
    
        let modal = document.getElementById('inventoryStatusModal');
    
        if (!modal) {
          document.body.insertAdjacentHTML(
            'beforeend',
            '<div class="modal" id="inventoryStatusModal"><div class="modal-box"><div class="modal-head"><h3>Edit Status Unit</h3><button type="button" class="close" id="closeInventoryStatus">×</button></div><form id="inventoryStatusForm"><p id="inventoryStatusVariant"></p><div class="form-grid"><div class="field"><label>Status</label><select id="inventoryNewStatus" required><option value="">Pilih status</option><option>Available</option><option>Laundry</option><option>Repair</option><option>Not Available</option></select></div><div class="field"><label>Kondisi</label><select id="inventoryNewCondition"><option>Good</option><option>Fair</option><option>Damaged</option><option>Unusable</option></select></div><div class="field"><label>Catatan</label><input id="inventoryStatusNotes" required maxlength="500"></div></div><div class="form-actions"><button type="submit" class="btn btn-primary">Simpan</button></div></form></div></div>'
          );
    
          modal = document.getElementById('inventoryStatusModal');

          document
            .getElementById('closeInventoryStatus')
            .addEventListener('click', () => modal.classList.remove('show'));

          const statusSelect = document.getElementById('inventoryNewStatus');
          const conditionSelect = document.getElementById('inventoryNewCondition');
          const syncUnusableStatus = () => {
            if (conditionSelect.value === 'Unusable') {
              statusSelect.value = 'Not Available';
            }
          };

          conditionSelect.addEventListener('change', syncUnusableStatus);
          statusSelect.addEventListener('change', syncUnusableStatus);

          document
            .getElementById('inventoryStatusForm')
            .addEventListener('submit', async event => {
              event.preventDefault();

              const condition = conditionSelect.value;
              const status = condition === 'Unusable'
                ? 'Not Available'
                : statusSelect.value;

              const { error } = await supabase.rpc('update_dress_unit_status', {
                p_unit_id: Number(modal.dataset.unitId),
                p_status: status,
                p_condition: condition,
                p_notes: document.getElementById('inventoryStatusNotes').value.trim()
              });
    
              if (error) {
                window.lave.toast(error.message, 'error');
                return;
              }
    
              modal.classList.remove('show');
              window.lave.toast('Status unit dan movement berhasil diperbarui.');
              await load();
    
              const variantId = Number(
                document.getElementById('inventoryDetailModal')?.dataset.variantId
              );
    
              if (variantId) await openDetail(variantId);
            });
        }
    
        modal.dataset.unitId = String(unitId);
    
        document.getElementById('inventoryStatusVariant').textContent =
          `${parentVariant?.dress_code || ''} - ${parentVariant?.name || ''} / ${parentVariant?.size || ''} / ${parentVariant?.color || ''} / ${unit.unit_code}`;
    
        document.getElementById('inventoryNewStatus').value = completeRepair
          ? 'Available'
          : ['Available', 'Laundry', 'Repair', 'Not Available'].includes(unit.status)
            ? unit.status
            : '';
    
        document.getElementById('inventoryNewCondition').value = completeRepair
          ? 'Good'
          : ['Good', 'Fair', 'Damaged', 'Unusable'].includes(unit.condition)
            ? unit.condition
            : 'Fair';

        if (document.getElementById('inventoryNewCondition').value === 'Unusable') {
          document.getElementById('inventoryNewStatus').value = 'Not Available';
        }

        document.getElementById('inventoryStatusNotes').value = completeRepair
          ? 'Perbaikan selesai; unit dinyatakan baik dan tersedia.'
          : '';
        modal.classList.add('show');
      }
    
      function openColorReconciliation(variantId) {
        const source = dresses.find(
          item => Number(item.dress_variant_id) === variantId
        );
    
        if (!source) return;
    
        const targets = dresses.filter(
          item =>
            Number(item.dress_id) === Number(source.dress_id) &&
            item.size.toUpperCase() === source.size.toUpperCase() &&
            item.color !== 'UNVERIFIED'
        );
    
        if (!targets.length) {
          window.lave.toast(
            'Tambahkan varian warna terverifikasi sebelum stocktake.',
            'error'
          );
          return;
        }
    
        let modal = document.getElementById('inventoryColorModal');
    
        if (!modal) {
          document.body.insertAdjacentHTML(
            'beforeend',
            '<div class="modal" id="inventoryColorModal"><div class="modal-box"><div class="modal-head"><h3>Rekonsiliasi Warna</h3><button type="button" class="close" id="closeInventoryColor">×</button></div><form id="inventoryColorForm"><p id="inventoryColorSource"></p><div class="form-grid"><div class="field"><label>Warna hasil stocktake</label><select id="inventoryTargetVariant" required></select></div><div class="field"><label>Jumlah unit hasil stocktake</label><input id="inventoryColorQuantity" type="number" min="1" required></div><div class="field"><label>Catatan stocktake</label><input id="inventoryColorNotes" required maxlength="500"></div></div><div class="form-actions"><button type="submit" class="btn btn-primary">Rekonsiliasi</button></div></form></div></div>'
          );
    
          modal = document.getElementById('inventoryColorModal');
    
          document
            .getElementById('closeInventoryColor')
            .addEventListener('click', () => modal.classList.remove('show'));
    
          document
            .getElementById('inventoryColorForm')
            .addEventListener('submit', async event => {
              event.preventDefault();
    
              const { error } = await supabase.rpc('reconcile_legacy_variant_color', {
                p_unverified_variant_id: Number(modal.dataset.sourceId),
                p_target_variant_id: Number(
                  document.getElementById('inventoryTargetVariant').value
                ),
                p_quantity: Number(
                  document.getElementById('inventoryColorQuantity').value
                ),
                p_notes: document
                  .getElementById('inventoryColorNotes')
                  .value
                  .trim()
              });
    
              if (error) {
                window.lave.toast(error.message, 'error');
                return;
              }
    
              modal.classList.remove('show');
              window.lave.toast(
                'Jumlah stok dipindahkan dan movement stocktake dicatat.'
              );
              await load();
            });
        }
    
        modal.dataset.sourceId = String(variantId);
    
        document.getElementById('inventoryColorSource').textContent =
          `${source.dress_code} - ${source.name} / ${source.size} / belum terpetakan (${source.quantity - source.rented_quantity} unit tidak disewa)`;
    
        const targetSelect = document.getElementById('inventoryTargetVariant');
    
        targetSelect.innerHTML = targets
          .map(
            target =>
              `<option value="${target.dress_variant_id}">${esc(target.color)}</option>`
          )
          .join('');
    
        const quantityInput = document.getElementById('inventoryColorQuantity');
        const movableUnits =
          Number(source.quantity || 0) - Number(source.rented_quantity || 0);
    
        quantityInput.max = String(movableUnits);
        quantityInput.value = movableUnits > 0 ? String(movableUnits) : '';
        quantityInput.disabled = movableUnits <= 0;
    
        modal.classList.add('show');
      }
    
      async function load() {
        const pageSubtitle = document.querySelector('.topbar .muted');
    
        if (pageSubtitle) {
          pageSubtitle.textContent =
            'Stok, status, warna, dan riwayat movement per varian';
        }
    
        document.getElementById('inventoryStatus').innerHTML =
          '<option value="">Semua status</option><option>Available</option><option>Rented</option><option>Laundry</option><option>Repair</option><option>Not Available</option><option>Mixed</option><option>Unclassified</option>';
    
        const [dressResult, movementResult] = await Promise.all([
          supabase
            .from('v_dress_inventory')
            .select('*')
            .order('dress_code')
            .order('size')
            .order('color'),
          supabase
            .from('dress_movements')
            .select(
              '*,dresses(dress_code,name),dress_variants(size,color),dress_units(unit_code)'
            )
            .order('movement_date', { ascending: false })
            .limit(200)
        ]);
    
        if (dressResult.error) {
          document.getElementById('inventoryRows').innerHTML =
            `<tr><td colspan="13" class="empty">Persediaan gagal dimuat dari database: ${esc(dressResult.error.message)}</td></tr>`;
    
          document.getElementById('movementRows').innerHTML =
            '<tr><td colspan="14" class="empty">Riwayat movement tidak dapat ditampilkan sebelum persediaan berhasil dimuat.</td></tr>';
    
          throw dressResult.error;
        }
    
        dresses = dressResult.data || [];
        render();
    
        if (movementResult.error) {
          document.getElementById('movementRows').innerHTML =
            `<tr><td colspan="14" class="empty">Riwayat movement belum tersedia: ${esc(movementResult.error.message)}</td></tr>`;
          return;
        }
    
        const movements = movementResult.data || [];
        const movementBody = document.getElementById('movementRows');
    
        movementBody.closest('table').querySelector('thead').innerHTML =
          '<tr><th>Tanggal</th><th>Kode Model</th><th>Nama Model</th><th>Ukuran</th><th>Warna</th><th>Unit</th><th>Jenis</th><th>Status</th><th>Δ Total</th><th>Δ Tersedia</th><th>Δ Disewa</th><th>Δ Tidak Tersedia</th><th>Referensi</th><th>Catatan</th></tr>';
    
        movementBody.innerHTML = movements.length
          ? movements
              .map(
                m =>
                  `<tr><td>${window.lave.formatDate(m.movement_date)}</td><td>${esc(m.dresses?.dress_code || '-')}</td><td>${esc(m.dresses?.name || '-')}</td><td>${esc(m.dress_variants?.size || '-')}</td><td>${esc(m.dress_variants?.color || '-')}</td><td>${esc(m.dress_units?.unit_code || '-')}</td><td>${esc(m.movement_type)}</td><td>${esc(m.status_before || '-')} → ${esc(m.status_after || '-')}</td><td>${m.quantity_delta > 0 ? '+' : ''}${m.quantity_delta}</td><td>${m.available_delta > 0 ? '+' : ''}${m.available_delta}</td><td>${m.rented_delta > 0 ? '+' : ''}${m.rented_delta}</td><td>${m.unavailable_delta > 0 ? '+' : ''}${m.unavailable_delta}</td><td>${esc(`${m.reference_type || ''} ${m.reference_code || m.reference_id || '-'}`)}</td><td>${esc(m.notes || m.description || '-')}</td></tr>`
              )
              .join('')
          : '<tr><td colspan="14" class="empty">Belum ada movement dress.</td></tr>';
      }
    
      document
        .getElementById('inventorySearch')
        .addEventListener('input', render);
    
      document
        .getElementById('inventoryStatus')
        .addEventListener('change', render);
    
      document
        .getElementById('printInventory')
        .addEventListener('click', () => window.print());
    
      load().catch(error => window.lave.toast(error.message, 'error'));
    }());
  },
  "settings.js": function () {
    (function () {
      const db = window.lave.supabase;
      const $ = id => document.getElementById(id);
      const set = (id, value) => {
        if ($(id)) $(id).value = value ?? '';
      };
      const get = id => $(id)?.value;
    
      function notify(message, type) {
        window.lave.toast(message, type || 'success');
      }
    
      $('passwordForm')?.remove();
      $('logoutButton')?.remove();
    
      const accessCard = $('account_email')?.closest('.card');
    
      if (accessCard) {
        accessCard.querySelector('h3').textContent = 'Akses Publik';
        accessCard.querySelector('label').textContent = 'Mode';
        $('account_role').previousElementSibling.textContent = 'Hak Akses';
        $('account_status').previousElementSibling.textContent = 'Autentikasi';
      }
    
      async function load() {
        const [business, accounting, preferences, audit] = await Promise.all([
          db
            .from('business_settings')
            .select('*')
            .eq('id', true)
            .single(),
          db
            .from('accounting_settings')
            .select('*')
            .eq('id', true)
            .single(),
          db
            .from('system_preferences')
            .select('*')
            .eq('id', true)
            .single(),
          db
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)
        ]);
    
        set('account_email', 'Akses publik');
        set('account_role', 'Administrator');
        set('account_status', 'Tanpa login');
    
        if (business.error) {
          notify(business.error.message, 'error');
        } else {
          const b = business.data || {};
          set('business_name', b.business_name);
          set('business_address', b.address);
          set('business_phone', b.phone);
          set('business_email', b.email);
          set('business_website', b.website);
          set('business_tax', b.tax_number);
          set('business_logo', b.logo_url);
          set('business_description', b.description);
        }
    
        if (accounting.data) {
          set('currency', accounting.data.currency || 'IDR');
          set('accounting_method', accounting.data.accounting_method);
          set('period_start', accounting.data.period_start);
          set('period_end', accounting.data.period_end);
        }
    
        if (preferences.data) {
          set('theme', preferences.data.theme);
          set('rows_per_page', preferences.data.rows_per_page);
          set('dashboard_period', preferences.data.dashboard_period);
          $('confirm_delete').checked = preferences.data.confirm_delete;
        }
    
        $('auditRows').innerHTML = audit.error
          ? `<tr><td colspan="4">${window.lave.escape(audit.error.message)}</td></tr>`
          : (audit.data || [])
              .map(
                row =>
                  `<tr><td>${window.lave.formatDate(row.created_at)}</td><td>${window.lave.escape(row.action)}</td><td>${window.lave.escape(row.module)}</td><td>${window.lave.escape(row.record_id || '-')}</td></tr>`
              )
              .join('');
      }
    
      $('businessForm').addEventListener('submit', async event => {
        event.preventDefault();
    
        const result = await db.from('business_settings').upsert({
          id: true,
          business_name: get('business_name'),
          address: get('business_address'),
          phone: get('business_phone'),
          email: get('business_email'),
          website: get('business_website'),
          tax_number: get('business_tax'),
          logo_url: get('business_logo'),
          description: get('business_description'),
          updated_at: new Date().toISOString()
        });
    
        if (result.error) {
          notify(result.error.message, 'error');
        } else {
          notify('Profil bisnis tersimpan.');
        }
      });
    
      $('accountingForm').addEventListener('submit', async event => {
        event.preventDefault();
    
        const result = await db.from('accounting_settings').upsert({
          id: true,
          accounting_method: get('accounting_method'),
          period_start: get('period_start') || null,
          period_end: get('period_end') || null
        });
    
        if (result.error) {
          notify(result.error.message, 'error');
        } else {
          notify('Pengaturan accounting tersimpan.');
        }
      });
    
      $('preferenceForm').addEventListener('submit', async event => {
        event.preventDefault();
    
        const result = await db.from('system_preferences').upsert({
          id: true,
          theme: get('theme'),
          rows_per_page: Number(get('rows_per_page')),
          dashboard_period: get('dashboard_period'),
          confirm_delete: $('confirm_delete').checked
        });
    
        if (result.error) {
          notify(result.error.message, 'error');
        } else {
          notify('Preferensi tersimpan.');
        }
      });
    
      load().catch(error => notify(error.message, 'error'));
    }());
  }
};

const frontendPageScripts = {
  "pembayaran-usaha": [
    {
      "type": "module",
      "name": "integrated-flow.js"
    }
  ],
  "dashboard": [
    {
      "type": "module",
      "name": "integrated-flow.js"
    }
  ],
  "dress": [
    {
      "type": "module",
      "name": "dress-master-api.js"
    },
    {
      "type": "module",
      "name": "master-dress.js"
    },
    {
      "type": "module",
      "name": "inventory.js"
    }
  ],
  "kas-keluar": [
    {
      "type": "inline",
      "code": "async function load() {\r\n            const { data, error } = await lave.supabase\r\n                .from('expenses')\r\n                .select('*')\r\n                .order('id', { ascending: false });\r\n\r\n            if (error) {\r\n                lave.toast(error.message, 'error');\r\n                return;\r\n            }\r\n\r\n            document.getElementById('tbody').innerHTML = (data || []).length\r\n                ? (data || []).map(r => `\r\n                    <tr>\r\n                        <td>${lave.escape(r['expense_code'])}</td>\r\n                        <td>${lave.escape(r['expense_date'])}</td>\r\n                        <td>${lave.escape(r['amount'])}</td>\r\n                        <td>${lave.escape(r['payment_method'])}</td>\r\n                    </tr>\r\n                `).join('')\r\n                : `<tr><td colspan=\"4\" class=\"empty\">Belum ada data.</td></tr>`;\r\n        }\r\n\r\n        load()"
    }
  ],
  "kas-masuk": [
    {
      "type": "inline",
      "code": "async function load() {\r\n            const { data, error } = await lave.supabase\r\n                .from('payments')\r\n                .select('*')\r\n                .order('id', { ascending: false });\r\n\r\n            if (error) {\r\n                lave.toast(error.message, 'error');\r\n                return;\r\n            }\r\n\r\n            document.getElementById('tbody').innerHTML = (data || []).length\r\n                ? (data || []).map(r => `\r\n                    <tr>\r\n                        <td>${lave.escape(r['payment_code'])}</td>\r\n                        <td>${lave.escape(r['payment_date'])}</td>\r\n                        <td>${lave.escape(r['amount'])}</td>\r\n                        <td>${lave.escape(r['payment_method'])}</td>\r\n                    </tr>\r\n                `).join('')\r\n                : `<tr><td colspan=\"4\" class=\"empty\">Belum ada data.</td></tr>`;\r\n        }\r\n\r\n        load()"
    }
  ],
  "laporan": [
    {
      "type": "module",
      "name": "integrated-flow.js"
    }
  ],
  "modal-pemilik": [
    {
      "type": "module",
      "name": "capital.js"
    }
  ],
  "pembayaran": [
    {
      "type": "module",
      "name": "integrated-flow.js"
    }
  ],
  "pembelian": [
    {
      "type": "module",
      "name": "integrated-flow.js"
    }
  ],
  "pengembalian": [
    {
      "type": "module",
      "name": "integrated-flow.js"
    }
  ],
  "penyewaan": [
    {
      "type": "module",
      "name": "integrated-flow.js"
    }
  ],
  "persediaan": [
    {
      "type": "module",
      "name": "dress-master-api.js"
    },
    {
      "type": "module",
      "name": "inventory.js"
    }
  ],
  "settings": [
    {
      "type": "module",
      "name": "settings.js"
    }
  ],
  "supplier": [
    {
      "type": "inline",
      "code": "let rows = [];\r\n        const keys = ['supplier_code', 'name', 'phone', 'email'];\r\n\r\n        async function load() {\r\n            const { data, error } = await lave.supabase\r\n                .from('suppliers')\r\n                .select('*')\r\n                .order('id', { ascending: false });\r\n\r\n            if (error) {\r\n                lave.toast(error.message, 'error');\r\n                return;\r\n            }\r\n\r\n            rows = data || [];\r\n            render();\r\n        }\r\n\r\n        function render() {\r\n            const q = (document.getElementById('search').value || '').toLowerCase();\r\n            const d = rows.filter(r => keys.some(k => String(r[k] ?? '').toLowerCase().includes(q)));\r\n\r\n            document.getElementById('tbody').innerHTML = d.length\r\n                ? d.map(r => `\r\n                    <tr>\r\n                        <td>${lave.escape(r['supplier_code'])}</td>\r\n                        <td>${lave.escape(r['name'])}</td>\r\n                        <td>${lave.escape(r['phone'])}</td>\r\n                        <td>${lave.escape(r['email'])}</td>\r\n                        <td><button class=\"btn btn-light\" style=\"padding:6px 9px\" onclick=\"editRow(${r.id})\">Edit</button> <button class=\"btn btn-danger\" style=\"padding:6px 9px\" onclick=\"del(${r.id})\">Hapus</button></td>\r\n                    </tr>\r\n                `).join('')\r\n                : `<tr><td colspan=\"5\" class=\"empty\">Belum ada data.</td></tr>`;\r\n        }\r\n\r\n        document.getElementById('search').addEventListener('input', render);\r\n\r\n        function openForm() {\r\n            form.reset();\r\n            editId.value = '';\r\n            modalTitle.textContent = 'Tambah Data';\r\n            openModal('modal');\r\n        }\r\n\r\n        function editRow(id) {\r\n            const r = rows.find(x => x.id == id);\r\n            editId.value = id;\r\n            keys.forEach(k => document.getElementById(k).value = r[k] ?? '');\r\n            modalTitle.textContent = 'Edit Data';\r\n            openModal('modal');\r\n        }\r\n\r\n        async function del(id) {\r\n            if (!confirmDelete()) return;\r\n\r\n            const { error } = await lave.supabase\r\n                .from('suppliers')\r\n                .delete()\r\n                .eq('id', id);\r\n\r\n            if (error) {\r\n                lave.toast(error.message, 'error');\r\n                return;\r\n            }\r\n\r\n            lave.toast('Data dihapus');\r\n            load();\r\n        }\r\n\r\n        form.addEventListener('submit', async e => {\r\n            e.preventDefault();\r\n            const p = {};\r\n\r\n            keys.forEach(k => {\r\n                const el = document.getElementById(k);\r\n                p[k] = el.type === 'number'\r\n                    ? (el.value ? Number(el.value) : null)\r\n                    : (el.value || null);\r\n            });\r\n\r\n            const id = editId.value;\r\n            const result = id\r\n                ? await lave.supabase.from('suppliers').update(p).eq('id', id)\r\n                : await lave.supabase.from('suppliers').insert(p);\r\n\r\n            if (result.error) {\r\n                lave.toast(result.error.message, 'error');\r\n                return;\r\n            }\r\n\r\n            lave.toast(id ? 'Data diperbarui' : 'Data ditambahkan');\r\n            closeModal('modal');\r\n            load();\r\n        });\r\n\r\n        load();"
    }
  ]
};

function openModal(id) {
  document.getElementById(id)?.classList.add('show')
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('show')
}

function confirmDelete(m = 'Hapus data ini?') {
  return confirm(m)
}

function formatDate(v) {
  return v ? new Date(v).toLocaleDateString('id-ID') : '-'
}

function setupMobileNavigation() {
  const sidebar = document.querySelector('.sidebar')
  const topbar = document.querySelector('.topbar')
  if (!sidebar || !topbar) return

  sidebar.id = 'appSidebar'

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'menu-toggle'
  toggle.setAttribute('aria-label', 'Buka menu navigasi')
  toggle.setAttribute('aria-controls', sidebar.id)
  toggle.setAttribute('aria-expanded', 'false')
  toggle.innerHTML = '<span></span><span></span><span></span>'
  topbar.prepend(toggle)

  const backdrop = document.createElement('button')
  backdrop.type = 'button'
  backdrop.className = 'sidebar-backdrop'
  backdrop.setAttribute('aria-label', 'Tutup menu navigasi')
  document.querySelector('.app')?.append(backdrop)

  const closeMenu = () => {
    document.body.classList.remove('mobile-nav-open')
    toggle.setAttribute('aria-expanded', 'false')
    toggle.setAttribute('aria-label', 'Buka menu navigasi')
  }

  toggle.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('mobile-nav-open')
    toggle.setAttribute('aria-expanded', String(isOpen))
    toggle.setAttribute('aria-label', isOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi')
  })

  backdrop.addEventListener('click', closeMenu)
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu))
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu()
  })
  window.matchMedia('(min-width: 721px)').addEventListener('change', closeMenu)
}

async function bootPage() {
  const p = document.body.dataset.page

  document.querySelectorAll('.brand span').forEach(label => {
    label.textContent = 'DRESS RENTAL & KEUANGAN'
  })
  document.querySelectorAll('.topbar .muted').forEach(label => {
    if (label.textContent.toLowerCase().includes('integrated rental')) {
      label.textContent = 'Integrated Rental · Inventory · Finance'
    }
  })

  document.querySelectorAll('.nav a').forEach(a => {
    if (a.dataset.page === p) a.classList.add('active')
  })

  document
    .querySelectorAll('.nav a[data-page="akun"], .nav a[data-page="buku-besar"], .nav a[data-page="neraca-saldo"]')
    .forEach(link => link.remove())
  document
    .querySelectorAll('.nav a[data-page="supplier"], .nav a[data-page="persediaan"]')
    .forEach(link => link.remove())

  document.querySelectorAll('.nav .nav-title').forEach(title => {
    if (title.textContent.trim().toLowerCase() === 'akuntansi') {
      title.textContent = 'Laporan'
    }
  })

  document.querySelectorAll('.nav a[data-page="pembayaran"], .nav a[data-page="kas-masuk"], .nav a[data-page="kas-keluar"]').forEach(el => el.remove())

  const nav = document.querySelector('.nav')

  if (nav && !nav.querySelector('[data-page="modal-pemilik"]')) {
    const link = document.createElement('a')
    link.href = '?page=modal-pemilik'
    link.dataset.page = 'modal-pemilik'
    link.textContent = 'Modal Pemilik'

    const existingFinanceTitle = Array.from(nav.querySelectorAll('.nav-title')).find(item =>
      ['persediaan & keuangan', 'keuangan'].includes(item.textContent.trim().toLowerCase())
    )
    const firstFinanceLink = nav.querySelector('a[data-page="pembelian"]')

    if (existingFinanceTitle && firstFinanceLink) {
      nav.insertBefore(link, firstFinanceLink)
    } else if (firstFinanceLink) {
      const title = document.createElement('div')
      title.className = 'nav-title'
      title.textContent = 'Keuangan'
      nav.insertBefore(title, firstFinanceLink)
      nav.insertBefore(link, firstFinanceLink)
    } else {
      nav.append(link)
    }

    if (p === 'modal-pemilik') link.classList.add('active')
  }

  if (nav) {
    const navTitles = Array.from(nav.querySelectorAll('.nav-title'))
    const financeTitle = navTitles.find(item =>
      ['persediaan & keuangan', 'keuangan'].includes(item.textContent.trim().toLowerCase())
    ) || (() => {
      const item = document.createElement('div')
      item.className = 'nav-title'
      nav.appendChild(item)
      return item
    })()

    financeTitle.textContent = 'Keuangan'

    const labels = {
      dress: '◇ Dress & Persediaan',
      penyewaan: '◇ Penyewaan',
      pengembalian: '↩ Pengembalian',
      'modal-pemilik': 'Modal Pemilik',
      pembelian: '＋ Pembelian',
      utang: '≡ Utang',
      'pembayaran-usaha': '◌ Pembayaran Usaha'
    }

    const findNavLink = pageName =>
      nav.querySelector(`a[data-page="${pageName}"]`)

    Object.entries(labels).forEach(([pageName, label]) => {
      const link = findNavLink(pageName)
      if (link) link.textContent = label
    })

    const rentalLabels = {
      penyewaan: '◇ Penyewaan',
      pengembalian: '↩ Pengembalian'
    }

    let rentalTitle = Array.from(nav.querySelectorAll('.nav-title')).find(
      item => item.textContent.trim().toLowerCase() === 'penyewaan'
    )

    if (!rentalTitle) {
      rentalTitle = document.createElement('div')
      rentalTitle.className = 'nav-title'
      rentalTitle.textContent = 'Penyewaan'
      nav.insertBefore(rentalTitle, financeTitle)
    }

    const rentalLinks = Object.entries(rentalLabels).map(([pageName, label]) => {
      let link = findNavLink(pageName)

      if (!link) {
        link = document.createElement('a')
        link.href = `?page=${pageName}`
        link.dataset.page = pageName
      }

      link.textContent = label
      return link
    })

    rentalTitle.after(...rentalLinks)

    const orderedFinanceLinks = [
      'modal-pemilik',
      'pembelian',
      'persediaan',
      'pembayaran-usaha'
    ].map(findNavLink).filter(Boolean)

    financeTitle.after(...orderedFinanceLinks)
  }

  setupMobileNavigation()

  const target = document.getElementById('currentUser') || document.querySelector('.topbar > .muted')
  if (target) target.textContent = 'Akses publik'
}

async function renderPage() {
  const root = document.getElementById('page-root')
  const requestedPage = new URLSearchParams(window.location.search).get('page') || 'dashboard'
  const pageAliases = {
    'kategori-dress': 'dress',
    persediaan: 'dress',
    supplier: 'pembelian',
    customer: 'penyewaan',
    denda: 'pengembalian',
    'kategori-biaya': 'pembayaran-usaha',
    'biaya-operasional': 'pembayaran-usaha',
    utang: 'pembayaran-usaha'
  }
  const pageName = pageAliases[requestedPage] || requestedPage
  if (pageName !== requestedPage) {
    const url = new URL(window.location.href)
    url.searchParams.set('page', pageName)
    window.history.replaceState({}, '', url)
  }
  const template = Array.from(document.querySelectorAll('template[data-page]'))
    .find(item => item.dataset.page === pageName)
  const activeTemplate = template || document.querySelector('template[data-page="dashboard"]')

  if (!root || !activeTemplate) {
    throw new Error('Template halaman aplikasi tidak ditemukan.')
  }

  const page = activeTemplate.dataset.page
  document.body.dataset.page = page
  document.title = page === 'dress'
    ? 'Dress & Persediaan — LAVÉ'
    : activeTemplate.dataset.title
  root.replaceChildren(activeTemplate.content.cloneNode(true))

  if (page === 'dress') {
    const main = root.querySelector('.main')
    const masterPanel = main?.querySelector('.page')
    const inventoryTemplate = document.querySelector('template[data-page="persediaan"]')
    const inventoryPanel = inventoryTemplate?.content.querySelector('.main > .page')?.cloneNode(true)

    if (main && masterPanel && inventoryPanel) {
      masterPanel.dataset.dressInventoryPanel = 'dress'
      inventoryPanel.dataset.dressInventoryPanel = 'inventory'
      inventoryPanel.hidden = true
      inventoryPanel.style.display = 'none'
      inventoryPanel.querySelector('h2').textContent = 'Dress & Persediaan / Ketersediaan'
      const tabs = document.createElement('div')
      tabs.className = 'form-actions'
      tabs.style.margin = '12px 0'
      tabs.innerHTML = '<button class="btn btn-primary" type="button" data-dress-inventory-tab="dress">Master Dress</button><button class="btn btn-light" type="button" data-dress-inventory-tab="inventory">Persediaan</button>'
      masterPanel.before(tabs)
      masterPanel.after(inventoryPanel)

      tabs.querySelectorAll('[data-dress-inventory-tab]').forEach(button => {
        button.addEventListener('click', () => {
          const selected = button.dataset.dressInventoryTab
          masterPanel.hidden = selected !== 'dress'
          inventoryPanel.hidden = selected !== 'inventory'
          masterPanel.style.display = selected === 'dress' ? '' : 'none'
          inventoryPanel.style.display = selected === 'inventory' ? '' : 'none'
          tabs.querySelectorAll('[data-dress-inventory-tab]').forEach(tab => {
            tab.classList.toggle('btn-primary', tab === button)
            tab.classList.toggle('btn-light', tab !== button)
          })
        })
      })

      if (requestedPage === 'persediaan') {
        tabs.querySelector('[data-dress-inventory-tab="inventory"]').click()
      }
    }
  }

  await bootPage()

  for (const descriptor of frontendPageScripts[page] || []) {
    if (descriptor.type === 'module') {
      const runModule = frontendModules[descriptor.name]
      if (!runModule) throw new Error('Modul frontend tidak ditemukan: ' + descriptor.name)
      runModule()
      continue
    }

    const script = document.createElement('script')
    script.textContent = descriptor.code
    document.body.append(script)
    script.remove()
  }

  if (!template) {
    window.lave.toast(`Halaman "${requestedPage}" tidak ditemukan. Dashboard ditampilkan.`, 'error')
  }
}
renderPage().catch(error => {
  if (window.lave && window.lave.handleSupabaseError) {
    window.lave.handleSupabaseError(error, {module: 'App', operation: 'INIT'})
  } else {
    console.error('Gagal memuat aplikasi', error)
  }
  const root = document.getElementById('page-root')
  if (root) root.textContent = 'Halaman gagal dimuat. Periksa koneksi dan konfigurasi aplikasi.'
})