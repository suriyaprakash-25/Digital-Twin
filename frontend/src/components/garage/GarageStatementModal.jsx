import { Printer } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

/** Printable garage financial statement. */
const GarageStatementModal = ({ statement, onClose }) => {
  const { dialogProps, titleId } = useDialog({ isOpen: true, onClose });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div {...dialogProps} className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden p-6 md:p-8 space-y-6 focus:outline-none">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">DrivePortz Official Financial Statement</span>
            <h2 id={titleId} className="text-xl font-black text-slate-900 mt-0.5">{statement.statementId}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>

        {/* Garage Info */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block">Service Partner</span>
            <strong className="text-slate-900 text-sm">{statement.garage?.name}</strong>
            <p className="text-slate-500 mt-1">{statement.garage?.address}</p>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block">Statement Period</span>
            <strong className="text-slate-900 text-sm">{statement.period}</strong>
            <p className="text-slate-500 mt-1">Generated: {new Date(statement.generatedAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Statement Summary Breakdown */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50">
                <td className="px-4 py-3 text-slate-600 font-medium">Total Period Gross Volume (GMV)</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">{money(statement.summary?.grossRevenue)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-slate-600">Less: Refund Adjustments</td>
                <td className="px-4 py-3 text-right font-bold text-rose-600 font-mono">- {money(statement.summary?.refundAmount)}</td>
              </tr>
              <tr className="bg-teal-50/70 border-t border-teal-200">
                <td className="px-4 py-3 font-bold text-teal-800">Net Partner Earnings</td>
                <td className="px-4 py-3 text-right font-black text-teal-700 text-sm font-mono">{money(statement.summary?.garageNetRevenue)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-slate-600">Less: Completed Settlement Payouts</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600 font-mono">- {money(statement.summary?.settledAmount)}</td>
              </tr>
              <tr className="bg-slate-50 font-bold border-t border-slate-200">
                <td className="px-4 py-3 text-slate-900">Closing Available Withdrawal Balance</td>
                <td className="px-4 py-3 text-right font-black text-teal-800 text-sm font-mono">{money(statement.summary?.availableBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-500 text-center">
          This statement is system-generated and mathematically verified by DrivePortz Financial Core.
        </p>
      </div>
    </div>
  );
};

export default GarageStatementModal;
