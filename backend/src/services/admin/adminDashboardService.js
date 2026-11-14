/**
 * Admin console: dashboard KPIs, revenue by garage, and growth analytics. Every figure is a count
 * or an aggregation inside MongoDB; no collection is loaded into memory.
 */
const {
  NOT_ARCHIVED,
  ACTIVE_GARAGE,
  VERIFIED_ACTIVE_GARAGE,
  completedBookingRevenuePipeline,
  revenueByGaragePipeline,
  topGaragesPipeline,
  monthlySeriesPipeline,
  monthlyRevenuePipeline,
} = require('./adminQueries');

const sumOf = (rows, field) => rows.reduce((acc, row) => acc + (row[field] || 0), 0);

/**
 * @param {{ users: object, garages: object, vehicles: object, serviceRecords: object, bookings: object }} repos
 */
function createAdminDashboardService({ users, garages, vehicles, serviceRecords, bookings }) {
  return {
    async getDashboard() {
      const [totalUsers, totalGarages, totalVehicles, totalServices, verifiedGarages, [revenue]] = await Promise.all([
        users.countAll(),
        garages.count(ACTIVE_GARAGE),
        vehicles.count(NOT_ARCHIVED),
        serviceRecords.count(NOT_ARCHIVED),
        garages.count(VERIFIED_ACTIVE_GARAGE),
        bookings.aggregate(completedBookingRevenuePipeline()),
      ]);
      const totalRevenue = revenue ? revenue.total : 0;
      return { totalUsers, totalGarages, totalVehicles, totalServices, totalRevenue, verifiedGarages };
    },

    async getRevenue() {
      const items = await bookings.aggregate(revenueByGaragePipeline());
      return {
        items,
        grandTotal: sumOf(items, 'totalRevenue'),
        totalServices: sumOf(items, 'totalServices'),
        totalGarages: items.length,
      };
    },

    async getAnalytics() {
      const [monthlyUsers, monthlyVehicles, monthlyServices, monthlyRevenue, topGarages] = await Promise.all([
        users.aggregate(monthlySeriesPipeline()),
        vehicles.aggregate(monthlySeriesPipeline(NOT_ARCHIVED)),
        serviceRecords.aggregate(monthlySeriesPipeline(NOT_ARCHIVED)),
        bookings.aggregate(monthlyRevenuePipeline()),
        bookings.aggregate(topGaragesPipeline()),
      ]);
      return { monthlyUsers, monthlyVehicles, monthlyServices, monthlyRevenue, topGarages };
    },
  };
}

module.exports = { createAdminDashboardService };
