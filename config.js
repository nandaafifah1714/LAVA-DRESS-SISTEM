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
