import * as Localization from 'expo-localization'
import * as SecureStore from 'expo-secure-store'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { Platform } from 'react-native'
import { ptTranslation } from './pt'

export type AppLanguage = 'es' | 'en' | 'pt'

const languageStorageKey = 'fint-language'

const resources = {
  es: {
    translation: {
      auth: { title: 'Fint', subtitle: 'Controla tus cuentas, movimientos y deudas desde un solo lugar.', email: 'Correo', password: 'Contrasena', confirmPassword: 'Confirmar contrasena', signIn: 'Entrar', signUp: 'Crear cuenta', google: 'Continuar con Google', headline: 'Dinero claro, mente tranquila.', intro: 'Registra gastos, ingresos y deudas. Fint te ayuda a ver tu mes sin enredos.', welcome: 'Bienvenido de vuelta', registerTitle: 'Crea tu cuenta', loginHint: 'Entra para revisar tus finanzas.', registerHint: 'Empieza a ordenar tu dinero desde Fint.', noAccount: 'No tienes cuenta?', hasAccount: 'Ya tienes cuenta?', registerLink: 'Registrate', loginLink: 'Inicia sesion', continueWith: 'O continua con', processing: 'Procesando...', invalidCredentials: 'Correo o contrasena incorrectos.', emailNotConfirmed: 'Confirma tu correo antes de iniciar sesion.', alreadyRegistered: 'Este correo ya tiene una cuenta.', invalidForm: 'Ingresa un correo valido y una contrasena de al menos 6 caracteres.', passwordMismatch: 'Las contrasenas no coinciden.' },
      header: { menuTitle: 'Preferencias', darkMode: 'Modo oscuro', lightMode: 'Modo claro', openMenu: 'Abrir menú' },
      profile: { title: 'Mi perfil' },
      tabs: { dashboard: 'Inicio', accounts: 'Cuentas', movements: 'Movimientos', debts: 'Deudas' },
      actions: { newAccount: 'Nueva cuenta', newMovement: 'Nuevo movimiento', newIncome: 'Ingreso', newExpense: 'Gasto', viewAll: 'Ver todos', signOut: 'Cerrar sesion', save: 'Guardar', cancel: 'Cancelar', retry: 'Reintentar' },
      states: { loading: 'Cargando...', errorTitle: 'No pudimos cargar la informacion', error: 'Comprueba tu conexion e intenta nuevamente.', invalidForm: 'Revisa los datos ingresados.', accountNotFound: 'No encontramos esta cuenta activa.', debtNotFound: 'No encontramos esta deuda activa.' },
      formLabels: { openingBalanceOptional: 'Saldo inicial (opcional)' },
      systemCategories: { debtPayment: 'Pago de deuda' },
      movementUx: { newIncomeTitle: 'Registrar ingreso', newExpenseTitle: 'Registrar gasto', editTitle: 'Editar movimiento', registerIncome: 'Registrar ingreso', registerExpense: 'Registrar gasto', noteOptional: 'Nota (opcional)', notePlaceholder: 'Ej: Compra semanal', updating: 'Guardando cambios...', updatedToast: 'Movimiento actualizado', updatedMessage: 'Los cambios se guardaron correctamente.', deleteTitle: '¿Eliminar este movimiento?', deleteDescription: '“{{name}}” se eliminará y el balance de la cuenta se recalculará.', deleteConfirm: 'Eliminar', deleting: 'Eliminando...', deletedToast: 'Movimiento eliminado', deletedMessage: 'El balance de la cuenta fue actualizado.', deleteError: 'No pudimos eliminar el movimiento.', period: 'Periodo', selectMonth: 'Seleccionar mes', pendingCount: '{{count}} pendiente(s)', pendingError: 'No pudimos cargar los movimientos detectados.', noPending: 'No tienes movimientos pendientes.', movementCount: '{{count}} movimientos', monthFlow: 'Flujo del periodo', detectedMovement: 'Movimiento detectado', discardPending: 'Descartar', confirmPending: 'Confirmar' },
      categoryUx: { identity: 'Dale identidad a tu categoría', changeEmoji: 'Cambiar emoji', selectedEmoji: 'Emoji elegido' },
      gmail: { title: 'Cuentas Gmail', description: 'Conecta hasta tres correos y limita la lectura a remitentes de movimientos financieros.', preferences: 'Gmail y sincronización', connect: 'Conectar otro correo', connected: 'Gmail conectado', empty: 'Aún no tienes cuentas Gmail conectadas.', senders: 'Remitentes permitidos', sendersHelp: 'Solo se procesarán correos enviados exactamente desde estas direcciones. Sepáralas por comas.', sync: 'Sincronizar', syncing: 'Sincronizando...', syncComplete: 'Sincronización completada', reconnectRequired: 'Esta cuenta requiere reconexión con Google.', reconnect: 'Reconectar correo', disconnect: 'Desconectar correo', lastSync: 'Última sincronización: {{date}}', notSynced: 'Aún no sincronizado' },
      empty: { accounts: 'Aun no tienes cuentas.', movements: 'Aun no tienes movimientos.', debts: 'Aun no tienes deudas.' },
      accountTypes: { cash: 'Efectivo', creditCard: 'Tarjeta de crédito', checkingAccount: 'Cuenta corriente', savingsAccount: 'Cuenta de ahorros' },
      accounts: { consolidatedBalance: 'Saldo total consolidado', assets: 'Activos disponibles', liabilities: 'Saldo por cubrir', myAccounts: 'Mis cuentas', accountCount: '{{count}} cuentas', emptyTitle: 'Crea tu primera cuenta', emptyDescription: 'Agrega dónde guardas o administras tu dinero para comenzar a organizar tus finanzas.', newTitle: 'Nueva cuenta', newSubtitle: 'Configura los datos básicos de tu cuenta.', editTitle: 'Editar cuenta', editSubtitle: 'Actualiza el nombre, tipo o moneda de tu cuenta.', namePlaceholder: 'Ej: Cuenta principal', searchCurrency: 'Buscar por código o moneda', duplicateName: 'Ya existe otra cuenta con ese nombre.', create: 'Agregar cuenta', creating: 'Creando cuenta...', update: 'Guardar cambios', updating: 'Guardando cambios...', createdToast: 'Cuenta creada', createdMessage: 'Tu nueva cuenta ya está disponible.', updatedToast: 'Cuenta actualizada', updatedMessage: 'Los cambios se guardaron correctamente.', editAccessibility: 'Editar cuenta {{name}}', deleteAccessibility: 'Eliminar cuenta {{name}}', deleteTitle: '¿Eliminar esta cuenta?', deleteDescription: 'La cuenta “{{name}}” dejará de aparecer en tus cuentas activas. Su historial financiero se conservará.', deleteConfirm: 'Eliminar', deleting: 'Eliminando...', deletedToast: 'Cuenta eliminada', deletedMessage: 'La cuenta quedó inactiva y su historial se conservó.', deleteError: 'No pudimos eliminar la cuenta' },
      categories: { routeTitle: 'Categorías', title: 'Tus categorías', subtitle: 'Organiza cómo clasificas ingresos y gastos.', newAction: 'Nueva', newTitle: 'Nueva categoría', newSubtitle: 'Elige un tipo, un icono y un nombre.', icon: 'Icono', namePlaceholder: 'Ej: Supermercado', nameRequired: 'Escribe un nombre de al menos 2 caracteres.', create: 'Agregar categoría', creating: 'Creando categoría...', createdToast: 'Categoría creada', createdMessage: 'Ya puedes usarla en tus movimientos.', emptyTitle: 'Sin categorías', emptyDescription: 'Crea una categoría para clasificar mejor tus movimientos.', loadError: 'No pudimos cargar tus categorías.' },
      movements: { historyTitle: 'Historial mensual', historySubtitle: 'Revisa tus ingresos y gastos por periodo.', formSubtitle: 'Registra el movimiento con una cuenta y categoría existentes.', selectAccount: 'Selecciona una cuenta', selectCategory: 'Selecciona una categoría', date: 'Fecha del movimiento', selectDate: 'Seleccionar fecha', loadingReferences: 'Cargando cuentas y categorías...', noAccounts: 'Necesitas una cuenta antes de registrar movimientos.', noCategories: 'Crea una categoría para este tipo de movimiento.', referencesError: 'No pudimos cargar las cuentas o categorías.', invalidForm: 'Revisa el monto, la fecha, la cuenta y la categoría.', creating: 'Guardando movimiento...', createdToast: 'Movimiento creado', createdMessage: 'El balance de tu cuenta fue actualizado.', loadError: 'No pudimos cargar tus movimientos.', emptyTitle: 'Sin movimientos en este periodo', emptyDescription: 'Registra un ingreso o gasto para comenzar.', previousMonth: 'Mes anterior', nextMonth: 'Mes siguiente', filters: { all: 'Todos', expense: 'Gastos', income: 'Ingresos' } },
      debts: { totalPending: 'Total deudas pendientes', activeDebts: 'Deudas activas', nextDue: 'Próximo vencimiento', noDueDate: 'Sin fecha', pending: 'Pendientes', pendingCount: '{{count}} deudas', newTitle: 'Nueva deuda', newSubtitle: 'Registra el monto y vencimiento de tu deuda.', editTitle: 'Editar deuda', editSubtitle: 'Actualiza los datos sin perder los pagos realizados.', namePlaceholder: 'Ej: Préstamo personal', dueDate: 'Fecha de vencimiento', selectDueDate: 'Seleccionar vencimiento', creditCardOptional: 'Tarjeta de crédito (opcional)', noCard: 'Ninguna', noCreditCards: 'No tienes tarjetas de crédito activas.', noteOptional: 'Nota (opcional)', notePlaceholder: 'Ej: Cuota 3 de 12', create: 'Agregar deuda', creating: 'Creando deuda...', update: 'Guardar cambios', updating: 'Guardando cambios...', createdToast: 'Deuda creada', createdMessage: 'La deuda ya aparece entre tus pendientes.', updatedToast: 'Deuda actualizada', updatedMessage: 'Los cambios se guardaron correctamente.', saveError: 'No pudimos guardar la deuda. Revisa los datos.', emptyTitle: 'Sin deudas pendientes', emptyDescription: 'Agrega una deuda para controlar vencimientos y pagos.', overdueDays: 'Vencida hace {{days}} días · {{date}}', dueToday: 'Vence hoy', dueInDays: 'Vence en {{days}} días · {{date}}', paidProgress: '{{progress}}% pagado', editAccessibility: 'Editar deuda {{name}}', payAccessibility: 'Pagar deuda {{name}}', deleteAccessibility: 'Eliminar deuda {{name}}', deleteTitle: '¿Eliminar esta deuda?', deleteDescription: '“{{name}}” dejará de aparecer como pendiente. Su historial de pagos se conservará.', deleteConfirm: 'Eliminar', deleting: 'Eliminando...', deletedToast: 'Deuda eliminada', deletedMessage: 'La deuda fue cancelada y su historial se conservó.', deleteError: 'No pudimos eliminar la deuda.', registerPayment: 'Registrar pago', paymentAccount: 'Cuenta de pago', noPaymentAccounts: 'No hay cuentas activas con la misma moneda para realizar el pago.', paymentNote: 'Nota del pago (opcional)', confirmPayment: 'Registrar pago', paying: 'Registrando pago...', paymentCreated: 'Pago registrado', paymentCreatedMessage: 'El pendiente de la deuda fue actualizado.', paymentError: 'No pudimos registrar el pago. Revisa el monto y la cuenta.' },
      onboarding: { title: 'Comienza con una base simple', baseCurrency: 'Moneda base sugerida: {{currency}}', firstAccount: 'Crea la cuenta donde organizas tu dinero.', firstMovement: 'Registra tu primer ingreso o gasto.', createAccount: 'Ir a crear una cuenta', createMovement: 'Registrar primer movimiento' },
      dashboard: {
        title: 'Tu resumen financiero',
        subtitle: 'Una mirada rapida a tu mes',
        totalBalance: 'Balance total',
        netWorth: 'Patrimonio total',
        monthFlow: 'Flujo del mes',
        weeklyFlow: 'Flujo semanal',
        positive: 'Positivo',
        negative: 'Negativo',
        totalIncome: 'Total ingresos',
        totalExpenses: 'Total gastos',
        balance: 'Balance',
        tapWeek: 'Toca una semana',
        tapCategory: 'Toca una categoría',
        weekAccessibility: 'Semana {{week}}, ingresos {{income}}, gastos {{expenses}}',
        categoryAccessibility: '{{category}}, gasto {{amount}}',
        quickActions: 'Registrar rapido',
        income: 'Ingresos',
        expenses: 'Gastos',
        monthlyIncome: 'Ingresos del mes',
        monthlyExpenses: 'Gastos del mes',
        savings: 'Ahorro',
        spendingByCategory: 'Gastos por categoría',
        currentMonth: 'Mes actual',
        allAccounts: 'Todas las cuentas',
        searchAccount: 'Buscar cuenta',
        recommendations: 'Consejos',
        recentActivity: 'Últimos movimientos',
        loading: 'Cargando tu panorama financiero...',
        errorTitle: 'No pudimos cargar el dashboard',
        emptyMovements: 'Aun no tienes movimientos. Registra tu primer ingreso o gasto.',
        emptyCategories: 'Registra gastos con categoria para ver tu distribucion.',
        emptyCategoriesForAccount: 'Esta cuenta no tiene gastos categorizados durante el mes actual.',
        savingStatus: 'Vas con saldo positivo este mes.',
        deficitStatus: 'Tus gastos superan tus ingresos este mes.',
        noIncomeTip: 'Agrega tus ingresos para comparar mejor tu mes.',
        highExpenseTip: 'Revisa tus categorias con mas gasto y define un limite simple.',
        firstMoveTip: 'Empieza registrando un ingreso o gasto para activar tu dashboard.',
        expensesIncreasing: 'Gastos en aumento',
        expensesControlled: 'Gastos bajo control',
        expensesSnapshot: 'Resumen de gastos',
        comparedPreviousMonth: 'Comparación con el mes anterior',
        vsPreviousMonth: 'vs. mes anterior',
        noPreviousData: 'Sin histórico previo',
        savingsGrowing: 'Ahorro creciendo',
        savingsNeedsAttention: 'Ahorro por recuperar',
        currentSavingsRate: 'Porcentaje de tus ingresos que conservas',
        monthlyBalance: 'Balance mensual',
        incomeMinusExpenses: 'Ingresos menos gastos del mes',
        positiveFlow: 'Flujo mensual positivo',
        negativeFlow: 'Flujo mensual negativo',
      },
      forms: { newAccount: 'Nueva cuenta', newMovement: 'Nuevo movimiento', amount: 'Monto', currency: 'Moneda', category: 'Categoria', account: 'Cuenta', note: 'Nota', expense: 'Gasto', income: 'Ingreso', name: 'Nombre', accountType: 'Tipo', cash: 'Efectivo', openingBalance: 'Saldo inicial', select: 'Seleccionar', accountCreated: 'Cuenta creada' },
    },
  },
  en: {
    translation: {
      auth: { title: 'Fint', subtitle: 'Track accounts, transactions, and debts in one place.', email: 'Email', password: 'Password', confirmPassword: 'Confirm password', signIn: 'Sign in', signUp: 'Create account', google: 'Continue with Google', headline: 'Clear money, calm mind.', intro: 'Track expenses, income, and debts. Fint helps you understand your month without friction.', welcome: 'Welcome back', registerTitle: 'Create your account', loginHint: 'Sign in to review your finances.', registerHint: 'Start organizing your money with Fint.', noAccount: 'No account?', hasAccount: 'Already have an account?', registerLink: 'Register', loginLink: 'Sign in', continueWith: 'Or continue with', processing: 'Processing...', invalidCredentials: 'Email or password is incorrect.', emailNotConfirmed: 'Confirm your email before signing in.', alreadyRegistered: 'This email already has an account.', invalidForm: 'Enter a valid email and a password with at least 6 characters.', passwordMismatch: 'Passwords do not match.' },
      header: { menuTitle: 'Preferences', darkMode: 'Dark mode', lightMode: 'Light mode', openMenu: 'Open menu' },
      profile: { title: 'My profile' },
      tabs: { dashboard: 'Home', accounts: 'Accounts', movements: 'Movements', debts: 'Debts' },
      actions: { newAccount: 'New account', newMovement: 'New movement', newIncome: 'Income', newExpense: 'Expense', viewAll: 'View all', signOut: 'Sign out', save: 'Save', cancel: 'Cancel', retry: 'Retry' },
      states: { loading: 'Loading...', errorTitle: 'We could not load the information', error: 'Check your connection and try again.', invalidForm: 'Review the entered information.', accountNotFound: 'This active account could not be found.', debtNotFound: 'This active debt could not be found.' },
      formLabels: { openingBalanceOptional: 'Opening balance (optional)' },
      systemCategories: { debtPayment: 'Debt payment' },
      movementUx: { newIncomeTitle: 'Record income', newExpenseTitle: 'Record expense', editTitle: 'Edit movement', registerIncome: 'Record income', registerExpense: 'Record expense', noteOptional: 'Note (optional)', notePlaceholder: 'E.g. Weekly groceries', updating: 'Saving changes...', updatedToast: 'Movement updated', updatedMessage: 'Your changes were saved successfully.', deleteTitle: 'Delete this movement?', deleteDescription: '“{{name}}” will be deleted and the account balance recalculated.', deleteConfirm: 'Delete', deleting: 'Deleting...', deletedToast: 'Movement deleted', deletedMessage: 'The account balance was updated.', deleteError: 'Could not delete the movement.', period: 'Period', selectMonth: 'Select month', pendingCount: '{{count}} pending', pendingError: 'Could not load detected movements.', noPending: 'You have no pending movements.', movementCount: '{{count}} movements', monthFlow: 'Period flow', detectedMovement: 'Detected movement', discardPending: 'Discard', confirmPending: 'Confirm' },
      categoryUx: { identity: 'Give your category an identity', changeEmoji: 'Change emoji', selectedEmoji: 'Selected emoji' },
      gmail: { title: 'Gmail accounts', description: 'Connect up to three inboxes and limit processing to financial notification senders.', preferences: 'Gmail and sync', connect: 'Connect another account', connected: 'Gmail connected', empty: 'You have no connected Gmail accounts yet.', senders: 'Allowed senders', sendersHelp: 'Only messages sent exactly from these addresses will be processed. Separate them with commas.', sync: 'Sync', syncing: 'Syncing...', syncComplete: 'Sync complete', reconnectRequired: 'This account needs to reconnect with Google.', reconnect: 'Reconnect account', disconnect: 'Disconnect account', lastSync: 'Last sync: {{date}}', notSynced: 'Not synced yet' },
      empty: { accounts: 'You do not have accounts yet.', movements: 'You do not have movements yet.', debts: 'You do not have debts yet.' },
      accountTypes: { cash: 'Cash', creditCard: 'Credit card', checkingAccount: 'Checking account', savingsAccount: 'Savings account' },
      accounts: { consolidatedBalance: 'Total consolidated balance', assets: 'Available assets', liabilities: 'Balance to cover', myAccounts: 'My accounts', accountCount: '{{count}} accounts', emptyTitle: 'Create your first account', emptyDescription: 'Add where you keep or manage money to start organizing your finances.', newTitle: 'New account', newSubtitle: 'Configure the basic details of your account.', editTitle: 'Edit account', editSubtitle: 'Update the name, type, or currency of your account.', namePlaceholder: 'E.g. Main account', searchCurrency: 'Search by code or currency', duplicateName: 'Another account already uses that name.', create: 'Add account', creating: 'Creating account...', update: 'Save changes', updating: 'Saving changes...', createdToast: 'Account created', createdMessage: 'Your new account is now available.', updatedToast: 'Account updated', updatedMessage: 'Your changes were saved successfully.', editAccessibility: 'Edit account {{name}}', deleteAccessibility: 'Delete account {{name}}', deleteTitle: 'Delete this account?', deleteDescription: '“{{name}}” will no longer appear in your active accounts. Its financial history will be preserved.', deleteConfirm: 'Delete', deleting: 'Deleting...', deletedToast: 'Account deleted', deletedMessage: 'The account is now inactive and its history was preserved.', deleteError: 'Could not delete the account' },
      categories: { routeTitle: 'Categories', title: 'Your categories', subtitle: 'Organize how you classify income and expenses.', newAction: 'New', newTitle: 'New category', newSubtitle: 'Choose a type, icon, and name.', icon: 'Icon', namePlaceholder: 'E.g. Groceries', nameRequired: 'Enter a name with at least 2 characters.', create: 'Add category', creating: 'Creating category...', createdToast: 'Category created', createdMessage: 'You can now use it in your movements.', emptyTitle: 'No categories', emptyDescription: 'Create a category to classify your movements.', loadError: 'Could not load your categories.' },
      movements: { historyTitle: 'Monthly history', historySubtitle: 'Review your income and expenses by period.', formSubtitle: 'Record the movement using an existing account and category.', selectAccount: 'Select an account', selectCategory: 'Select a category', date: 'Movement date', selectDate: 'Select date', loadingReferences: 'Loading accounts and categories...', noAccounts: 'You need an account before recording movements.', noCategories: 'Create a category for this movement type.', referencesError: 'Could not load accounts or categories.', invalidForm: 'Review the amount, date, account, and category.', creating: 'Saving movement...', createdToast: 'Movement created', createdMessage: 'Your account balance was updated.', loadError: 'Could not load your movements.', emptyTitle: 'No movements in this period', emptyDescription: 'Record income or an expense to get started.', previousMonth: 'Previous month', nextMonth: 'Next month', filters: { all: 'All', expense: 'Expenses', income: 'Income' } },
      debts: { totalPending: 'Total pending debt', activeDebts: 'Active debts', nextDue: 'Next due date', noDueDate: 'No date', pending: 'Pending', pendingCount: '{{count}} debts', newTitle: 'New debt', newSubtitle: 'Record the amount and due date of your debt.', editTitle: 'Edit debt', editSubtitle: 'Update its details without losing recorded payments.', namePlaceholder: 'E.g. Personal loan', dueDate: 'Due date', selectDueDate: 'Select due date', creditCardOptional: 'Credit card (optional)', noCard: 'None', noCreditCards: 'You have no active credit cards.', noteOptional: 'Note (optional)', notePlaceholder: 'E.g. Installment 3 of 12', create: 'Add debt', creating: 'Creating debt...', update: 'Save changes', updating: 'Saving changes...', createdToast: 'Debt created', createdMessage: 'The debt now appears in your pending list.', updatedToast: 'Debt updated', updatedMessage: 'Your changes were saved successfully.', saveError: 'Could not save the debt. Review the details.', emptyTitle: 'No pending debts', emptyDescription: 'Add a debt to track due dates and payments.', overdueDays: 'Overdue by {{days}} days · {{date}}', dueToday: 'Due today', dueInDays: 'Due in {{days}} days · {{date}}', paidProgress: '{{progress}}% paid', editAccessibility: 'Edit debt {{name}}', payAccessibility: 'Pay debt {{name}}', deleteAccessibility: 'Delete debt {{name}}', deleteTitle: 'Delete this debt?', deleteDescription: '“{{name}}” will no longer appear as pending. Its payment history will be preserved.', deleteConfirm: 'Delete', deleting: 'Deleting...', deletedToast: 'Debt deleted', deletedMessage: 'The debt was cancelled and its history was preserved.', deleteError: 'Could not delete the debt.', registerPayment: 'Record payment', paymentAccount: 'Payment account', noPaymentAccounts: 'There are no active accounts with the same currency for this payment.', paymentNote: 'Payment note (optional)', confirmPayment: 'Record payment', paying: 'Recording payment...', paymentCreated: 'Payment recorded', paymentCreatedMessage: 'The debt balance was updated.', paymentError: 'Could not record the payment. Review the amount and account.' },
      onboarding: { title: 'Start with a simple foundation', baseCurrency: 'Suggested base currency: {{currency}}', firstAccount: 'Create the account where you organize your money.', firstMovement: 'Record your first income or expense.', createAccount: 'Create an account', createMovement: 'Record first movement' },
      dashboard: {
        title: 'Your financial snapshot',
        subtitle: 'A quick look at your month',
        totalBalance: 'Total balance',
        netWorth: 'Total net worth',
        monthFlow: 'Monthly flow',
        weeklyFlow: 'Weekly flow',
        positive: 'Positive',
        negative: 'Negative',
        totalIncome: 'Total income',
        totalExpenses: 'Total expenses',
        balance: 'Balance',
        tapWeek: 'Tap a week',
        tapCategory: 'Tap a category',
        weekAccessibility: 'Week {{week}}, income {{income}}, expenses {{expenses}}',
        categoryAccessibility: '{{category}}, spending {{amount}}',
        quickActions: 'Quick entry',
        income: 'Income',
        expenses: 'Expenses',
        monthlyIncome: 'Monthly income',
        monthlyExpenses: 'Monthly expenses',
        savings: 'Savings',
        spendingByCategory: 'Spending by category',
        currentMonth: 'Current month',
        allAccounts: 'All accounts',
        searchAccount: 'Search account',
        recommendations: 'Tips',
        recentActivity: 'Latest movements',
        loading: 'Loading your financial overview...',
        errorTitle: 'Could not load dashboard',
        emptyMovements: 'No movements yet. Add your first income or expense.',
        emptyCategories: 'Add expenses with categories to see your distribution.',
        emptyCategoriesForAccount: 'This account has no categorized expenses during the current month.',
        savingStatus: 'You have a positive flow this month.',
        deficitStatus: 'Your expenses are above your income this month.',
        noIncomeTip: 'Add your income to compare your month better.',
        highExpenseTip: 'Review your top spending categories and set a simple limit.',
        firstMoveTip: 'Start by adding an income or expense to activate your dashboard.',
        expensesIncreasing: 'Expenses increasing',
        expensesControlled: 'Expenses under control',
        expensesSnapshot: 'Expense snapshot',
        comparedPreviousMonth: 'Compared with the previous month',
        vsPreviousMonth: 'vs. previous month',
        noPreviousData: 'No previous history',
        savingsGrowing: 'Savings growing',
        savingsNeedsAttention: 'Savings need attention',
        currentSavingsRate: 'Percentage of income you keep',
        monthlyBalance: 'Monthly balance',
        incomeMinusExpenses: 'Monthly income minus expenses',
        positiveFlow: 'Positive monthly flow',
        negativeFlow: 'Negative monthly flow',
      },
      forms: { newAccount: 'New account', newMovement: 'New movement', amount: 'Amount', currency: 'Currency', category: 'Category', account: 'Account', note: 'Note', expense: 'Expense', income: 'Income', name: 'Name', accountType: 'Type', cash: 'Cash', openingBalance: 'Opening balance', select: 'Select', accountCreated: 'Account created' },
    },
  },
  pt: { translation: ptTranslation },
}

const deviceCode = Localization.getLocales()[0]?.languageCode
const deviceLanguage: AppLanguage = deviceCode === 'en' || deviceCode === 'pt' ? deviceCode : 'es'

i18n.use(initReactI18next).init({ resources, lng: deviceLanguage, fallbackLng: 'es', interpolation: { escapeValue: false } })

export async function loadStoredLanguage() {
  const value = Platform.OS === 'web' ? window.localStorage.getItem(languageStorageKey) : await SecureStore.getItemAsync(languageStorageKey)
  if (value === 'es' || value === 'en' || value === 'pt') await i18n.changeLanguage(value)
}

export async function changeAppLanguage(language: AppLanguage) {
  await i18n.changeLanguage(language)
  if (Platform.OS === 'web') window.localStorage.setItem(languageStorageKey, language)
  else await SecureStore.setItemAsync(languageStorageKey, language)
}

export function getAppLocale(language = i18n.resolvedLanguage) {
  return language === 'en' ? 'en-US' : language === 'pt' ? 'pt-BR' : 'es-PE'
}

export default i18n
