import React, { useState } from "react";
import axios from "axios";

const initialData = {
  account_id: "frontend_test_001",
  TransactionAmount: 350.25,
  CustomerAge: 27,
  TransactionDuration: 4.2,
  LoginAttempts: 2,
  AccountBalance: 8000.0,
  user_transaction_count: 12,
  user_avg_transaction_amount: 300.0,
  deviation_from_user_avg: 50.25,
  transaction_hour: 16,
  transaction_day_of_week: 3,
  TransactionType: "Credit",
  Location: "Los Angeles",
  Channel: "Web",
  CustomerOccupation: "Designer",
  user_primary_location: "Los Angeles",
  is_unusual_location: "False"
};

const inputFields = [
  { name: "account_id", label: "Account ID", type: "text" },
  { name: "TransactionAmount", label: "Transaction Amount", type: "number", step: "0.01" },
  { name: "CustomerAge", label: "Customer Age", type: "number" },
  { name: "TransactionDuration", label: "Transaction Duration", type: "number", step: "0.1" },
  { name: "LoginAttempts", label: "Login Attempts", type: "number" },
  { name: "AccountBalance", label: "Account Balance", type: "number", step: "0.01" },
  { name: "user_transaction_count", label: "User Transaction Count", type: "number" },
  { name: "user_avg_transaction_amount", label: "User Avg Transaction", type: "number", step: "0.01" },
  { name: "deviation_from_user_avg", label: "Deviation from Avg", type: "number", step: "0.01" },
  { name: "transaction_hour", label: "Transaction Hour", type: "number" },
  { name: "transaction_day_of_week", label: "Day of Week", type: "number" },
  { name: "TransactionType", label: "Transaction Type", type: "select", options: ["Credit", "Debit", "Purchase", "Transfer"] },
  { name: "Location", label: "Location", type: "select", options: ["Los Angeles", "New York", "San Francisco", "Chicago", "Other"] },
  { name: "Channel", label: "Channel", type: "select", options: ["Web", "Mobile", "ATM", "POS"] },
  { name: "CustomerOccupation", label: "Occupation", type: "select", options: ["Designer", "Engineer", "Teacher", "Sales", "Other"] },
  { name: "user_primary_location", label: "Primary Location", type: "select", options: ["Los Angeles", "New York", "San Francisco", "Chicago", "Other"] },
  { name: "is_unusual_location", label: "Unusual Location", type: "select", options: ["False", "True"] }
];

export default function TransactionScore() {
  const [form, setForm] = useState(initialData);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
    setError(null);
    try {
      const response = await axios.post("http://127.0.0.1:8000/transactions/score", {
        ...form,
        TransactionAmount: parseFloat(form.TransactionAmount),
        CustomerAge: parseInt(form.CustomerAge, 10),
        TransactionDuration: parseFloat(form.TransactionDuration),
        LoginAttempts: parseInt(form.LoginAttempts, 10),
        AccountBalance: parseFloat(form.AccountBalance),
        user_transaction_count: parseFloat(form.user_transaction_count),
        user_avg_transaction_amount: parseFloat(form.user_avg_transaction_amount),
        deviation_from_user_avg: parseFloat(form.deviation_from_user_avg),
        transaction_hour: parseInt(form.transaction_hour, 10),
        transaction_day_of_week: parseInt(form.transaction_day_of_week, 10)
      });
      setResult(response.data);
    } catch (err) {
      setError(err.response ? err.response.data : err.message);
    }
  };

  return (
    <div className="scoring-card">
      <div className="panel-header">
        <div>
          <h2>Score a Transaction</h2>
          <p>Send a sample transaction to the fraud model and inspect the output.</p>
        </div>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        {inputFields.map((field) => (
          <label className="input-group" key={field.name}>
            <span>{field.label}</span>
            {field.type === "select" ? (
              <select name={field.name} value={form[field.name]} onChange={handleChange}>
                {field.options.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
                type={field.type}
                step={field.step}
                autoComplete="off"
              />
            )}
          </label>
        ))}

        <button className="primary-button" type="submit">
          Score Transaction
        </button>
      </form>

      {result && (
        <div className="result-panel">
          <div className="result-header">
            <div>
              <h3>Model Output</h3>
              <p>Fraud score and prediction summary for the submitted transaction.</p>
            </div>
          </div>

          <div className="result-grid">
            <div className={`result-metric ${result.prediction?.toLowerCase().includes("fraud") ? "fraud" : "safe"}`}>
              <span className="metric-label">Prediction</span>
              <span className="metric-value">{result.prediction ?? "Unknown"}</span>
            </div>
            <div className="result-metric">
              <span className="metric-label">Fraud Score</span>
              <span className="metric-value">{typeof result.fraud_score === "number" ? result.fraud_score.toFixed(2) : result.fraud_score}</span>
            </div>
          </div>

          <div className="result-card">
            <h4>Raw Response</h4>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}

      {error && (
        <div className="error-card">
          <h3>Error</h3>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
