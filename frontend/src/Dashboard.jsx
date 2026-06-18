import React, { useEffect, useState } from "react";
import axios from "axios";

const Dashboard = () => {
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await axios.get("http://localhost:8000/transactions/history");
        setTransactions(response.data);
      } catch (err) {
        setTransactions([]);
      }
    };

    fetchTransactions();
  }, []);

  useEffect(() => {
    setAlerts(
      transactions
        .filter((tx) => tx.is_fraud === true)
        .map((tx, idx) => ({
          id: `alert_${idx}`,
          transaction_id: tx.id || tx.transaction_id || idx,
          type: "HIGH_RISK",
          time: tx.event_time,
        }))
    );
  }, [transactions]);

  return (
    <div className="dashboard">
      <div className="panel-header">
        <div>
          <h1>Fraud Detection Dashboard</h1>
          <p>Track suspicious activity and review recent transaction history.</p>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="transaction-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Location</th>
              <th>Time</th>
              <th>Status</th>
              <th>Anomaly</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  No transactions available.
                </td>
              </tr>
            ) : (
              transactions.map((tx, idx) => (
                <tr key={tx.id || tx.transaction_id || idx}>
                  <td>{tx.id || tx.transaction_id || "—"}</td>
                  <td>{tx.account_id || "—"}</td>
                  <td>${tx.amount?.toFixed(2) ?? "—"}</td>
                  <td>{tx.location || "—"}</td>
                  <td>{tx.event_time ? new Date(tx.event_time).toLocaleString() : "—"}</td>
                  <td>
                    <span className={`status-badge ${tx.is_fraud ? "fraud" : "safe"}`}>
                      {tx.is_fraud ? "Fraud" : "Clear"}
                    </span>
                  </td>
                  <td>{tx.fraud_probability !== undefined ? tx.fraud_probability.toFixed(4) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="alerts-panel">
        <h2>Alerts</h2>
        {alerts.length === 0 ? (
          <p className="empty-state">No active fraud alerts.</p>
        ) : (
          <ul className="alert-list">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <strong>{alert.type}</strong> detected for transaction {alert.transaction_id} at{' '}
                {alert.time ? new Date(alert.time).toLocaleString() : "unknown time"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
