# ❤️ HeartBreakers  
### GenAI Agent for Universal, Dimension-Based Data Quality Scoring (Fintech Domain)

> **Problem Statement**  
> *An ontology-driven semantic approach embedded with evolutionary algorithms to assess dataset quality, with GenAI enabling explainability and insights.*

---

## 📌 Overview

**Finova** is an intelligent **GenAI-powered data quality assessment system** designed for the **Fintech domain**.  
It introduces a **universal, explainable, and privacy-preserving Data Quality Scoring (DQS)** mechanism by combining:

- 🧠 **Ontology-driven semantic reasoning**
- 🧬 **Evolutionary algorithms for multi-objective optimization**
- 🤖 **GenAI for explainability and actionable insights**

Unlike static, rule-based scoring systems, our approach **understands data context**, **optimizes trade-offs dynamically**, and **explains results transparently**—without ever exposing raw sensitive data.

---

## 🎯 Problem Statement

Payment organizations process massive volumes of transactional data, yet:

- There is **no standardized way** to score data quality
- Existing methods rely on **static rules**
- GenAI-only approaches risk **hallucination and privacy leakage**

This project solves these gaps by delivering a **dimension-based, universal Data Quality Score (DQS)** across datasets.

---

## 🧩 Key Data Quality Dimensions

The system evaluates datasets across standard dimensions such as:

- Accuracy  
- Completeness  
- Consistency  
- Timeliness  
- Uniqueness  
- Validity  
- Integrity  

Each dimension receives:
- 📊 An individual score
- 🧮 Contribution to a **composite DQS**
- 📝 Clear, human-readable explanation

---

## 🏗️ System Architecture

### 🔹 1. Knowledge Layer (Ontology-Driven)
- Domain-specific ontology for payments data
- Maps attributes → quality dimensions
- Reasons over relationships and context
- Produces **semantic abstractions**, not raw data

### 🔹 2. Evolutionary Algorithm Layer
- Multi-objective optimization
- Dynamically balances competing dimensions
- Stabilizes scoring across datasets
- Replaces static weight-based formulas

### 🔹 3. GenAI Layer (Explainability Only)
- Converts semantic outputs into:
  - Plain-language explanations
  - Actionable improvement recommendations
- **Does NOT calculate scores**
- Operates only on **semantic facts**, ensuring zero hallucination

---

## 🔐 Privacy & Governance by Design

- ❌ Raw transaction data never reaches GenAI
- ✅ Only metadata, semantic abstractions, and reasoning facts are used
- ✅ No data storage — only scoring outputs
- ✅ Fully compliant with governance and audit requirements

---

## 🧠 Why This Approach Stands Out

✔ Ontology-driven reasoning (not static rules)  
✔ Evolutionary trade-off optimization (not fixed scoring)  
✔ GenAI used **only** for explainability  
✔ Maximum privacy via semantic abstraction  
✔ Reusable and extensible framework across domains  

---

## 🗂️ Repository Structure
```text
HeartBreakers/
├── Frontend/ # Dashboard & UI
├── finova_backend/ # Core backend logic
│ ├── ontology/ # Domain ontology definitions
│ ├── profiler/ # Data profiling & metadata extraction
│ ├── evolutionary_algo/ # EA-based optimization engine
│ ├── genai/ # Explainability & summarization layer
│ └── api/ # Secure APIs
├── requirements.txt
├── .env.example
└── README.md
```
---

## 🚀 How It Works (High Level)

1. Dataset is securely ingested (file / table / API)
2. Data profiler extracts metadata and statistics
3. Ontology layer identifies:
   - Relevant attributes
   - Applicable quality dimensions
4. Evolutionary algorithm:
   - Optimizes dimension weights
   - Computes stable DQS
5. GenAI generates:
   - Explanations
   - Recommendations
6. UI displays scores, insights, and improvement paths

---

## 👥 Team – *HeartBreakers*


- **Shantharam**
- **Ashwin K**
- **Aswath Siddharth R**
- **R Darshan**

---

## 📄 License

This project is licensed under the **MIT License**.

---

## ⭐ Acknowledgements

- Anokha 2026 – 24 Hour Build2Break Hackathon

---

> *Building a new, standardized, semantic, and explainable future for data quality in Fintechs.*