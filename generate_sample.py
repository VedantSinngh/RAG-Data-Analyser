import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

# Create a date range (2 years of data for good forecasting/time-series)
dates = pd.date_range(start='2022-01-01', periods=730, freq='D')

# Categorical variables
categories = ['Electronics', 'Apparel', 'Home & Garden', 'Sports']
regions = ['North', 'South', 'East', 'West']
channels = ['Online', 'Retail', 'Wholesale']

# Generate data
np.random.seed(42)
random.seed(42)
data = []

# Base trend and seasonality components
t = np.arange(730)
trend = t * 0.8  # Upward trend
seasonality = np.sin(t * 2 * np.pi / 365) * 200 + np.sin(t * 2 * np.pi / 30) * 50  # Yearly + Monthly seasonality

for i, date in enumerate(dates):
    # Pick random categories for this row
    cat = np.random.choice(categories, p=[0.4, 0.3, 0.2, 0.1])
    reg = np.random.choice(regions)
    chan = np.random.choice(channels, p=[0.6, 0.3, 0.1])
    
    # Base sales with trend, seasonality, and noise
    base_sales = 500 + trend[i] + seasonality[i] + np.random.normal(0, 100)
    
    # Category and Region multipliers
    cat_mult = {'Electronics': 1.5, 'Apparel': 0.9, 'Home & Garden': 1.1, 'Sports': 0.7}[cat]
    reg_mult = {'North': 1.2, 'South': 0.9, 'East': 1.1, 'West': 1.0}[reg]
    chan_mult = {'Online': 1.3, 'Retail': 1.0, 'Wholesale': 0.8}[chan]
    
    # Primary numeric metrics
    revenue = max(100, base_sales * cat_mult * reg_mult * chan_mult)
    
    # Correlated metrics
    # Profit is closely tied to revenue but varies by category
    profit_margin = {'Electronics': 0.15, 'Apparel': 0.35, 'Home & Garden': 0.25, 'Sports': 0.30}[cat]
    profit = revenue * np.random.normal(profit_margin, 0.05)
    
    # Marketing spend drives revenue (or vice versa in this mock data)
    marketing_spend = revenue * np.random.uniform(0.05, 0.12)
    
    # Units sold
    unit_price = {'Electronics': 250, 'Apparel': 45, 'Home & Garden': 120, 'Sports': 60}[cat]
    units_sold = int(revenue / unit_price) + np.random.randint(1, 15)
    
    # Customer satisfaction (1-5), slightly inversely correlated with high volume days (delays)
    satisfaction = np.clip(np.random.normal(4.2, 0.6) - (revenue / 5000), 1.0, 5.0)
    
    # Text data for RAG / NLP features
    rag_notes = random.choice([
        f"Strong performance in {reg} region driven by {cat} sales.",
        f"Supply chain delays affected {chan} availability.",
        f"Customer feedback highlighted fast shipping for {cat}.",
        f"Competitor pricing pressure noted in {reg} market.",
        f"Successful email campaign boosted {chan} metrics.",
        "Standard operational day, no major incidents.",
        f"Inventory shortage expected for {cat} next month.",
        f"High return rate observed in {chan} channel."
    ])
    
    data.append({
        'Date': date.strftime('%Y-%m-%d'),
        'Category': cat,
        'Region': reg,
        'Sales_Channel': chan,
        'Revenue': round(revenue, 2),
        'Profit': round(profit, 2),
        'Units_Sold': units_sold,
        'Marketing_Spend': round(marketing_spend, 2),
        'Customer_Satisfaction': round(satisfaction, 1),
        'Daily_Active_Users': int(revenue * 0.8) + np.random.randint(-50, 50), # Another correlated metric
        'Feedback_Notes': rag_notes
    })

df = pd.DataFrame(data)
df.to_csv('comprehensive_sample_data.csv', index=False)
print("Successfully generated comprehensive_sample_data.csv with", len(df), "rows.")
