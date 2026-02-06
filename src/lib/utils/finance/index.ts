// Personal Finance utilities - centralized exports

// Formatters
export {
  formatCurrency,
  formatBalance,
  formatTransactionAmount,
  parseAmount,
  formatCardNumber,
  formatPercentage,
  calculatePercentageChange,
  formatExchangeRate,
  convertCurrency
} from './formatters'

// Validators
export {
  validateWallet,
  validateTransaction,
  validateCategory,
  validateAmountInput,
  validateClosingDay,
  validateDueDay,
  validateHexColor,
  sanitizeDescription,
  validateWalletTypeFields,
  type ValidationResult
} from './validators'

// Helpers
export {
  calculateNextDueDate,
  calculateAvailableCredit,
  calculateTotalBalance,
  getWalletDisplayName,
  getWalletTypeIndicator,
  getTransactionTypeIndicator,
  updateWalletBalance,
  groupTransactionsByMonth,
  calculateMonthlyTotals,
  isStatementOverdue,
  getCreditCardStatus,
  generateWalletColor,
  generateTransactionId,
  generateWalletId,
  generateCategoryId,
  generateStatementId,
  generatePaymentId,
  filterTransactionsByDateRange,
  getCurrentMonthRange,
  getLastNMonthsRange,
  getDaysUntilDue,
  sortTransactionsByDate,
  sortWallets
} from './helpers'

// Balance Operations
export {
  updateWalletBalanceInDb,
  processTransactionBalanceUpdate,
  reverseTransactionBalanceUpdate,
  validateSufficientFunds,
  getWalletBalanceSummary,
  recalculateWalletBalance,
  fixWalletBalance,
  type WalletBalanceSummary
} from './balance-operations'

// Credit Card Statement Management
export {
  getCurrentStatement,
  createNewStatement,
  calculateStatementPeriod,
  addTransactionToStatement,
  updateStatementTotals,
  closeStatement,
  processAutomaticStatementClosings,
  getStatementSummary,
  getUpcomingDueDates
} from './credit-card-statements'

// Credit Card Payment Management
export {
  processCreditCardPayment,
  makeMinimumPayment,
  payFullBalance,
  getCreditCardPaymentHistory,
  getSuggestedPayments,
  validatePaymentAmount,
  getCreditCardPaymentStats,
  scheduleAutomaticPayment
} from './credit-card-payments'

// Credit Card Notifications
export {
  generateDueNotifications,
  generateClosingNotifications,
  generateCreditUsageNotifications,
  getAllCreditCardNotifications,
  getNotificationSummary,
  formatNotificationForDisplay,
  type CreditCardNotification
} from './credit-card-notifications'