"""Standalone IRR calculator extracted verbatim from deal_calculator.py.

No Flask, no LangChain, no DB — just the math, so we can generate golden
reference values for the TypeScript port without reviving the Python stack.

Run: python3 extract_irr_golden.py > ../irr_reference_values.json
"""

import json


# --- begin verbatim port of calculate_irr_analysis + calculate_irr_manual ---
def calculate_irr_manual(cash_flows):
    def npv(rate, cfs):
        return sum(cf / (1 + rate) ** i for i, cf in enumerate(cfs))

    low, high = -0.99, 10.0
    mid = 0.0
    for _ in range(100):
        mid = (low + high) / 2
        if abs(npv(mid, cash_flows)) < 1e-6:
            return mid
        elif npv(mid, cash_flows) > 0:
            low = mid
        else:
            high = mid
    return mid


def calculate_irr_analysis(deal_data):
    purchase_price = deal_data['purchase_price']
    noi_year_1 = deal_data['net_operating_income']
    noi_growth_rate = deal_data['noi_growth_rate'] / 100
    hold_period = deal_data['hold_period']
    exit_cap_rate = deal_data['exit_cap_rate'] / 100

    cash_flows = [-purchase_price]
    for year in range(1, hold_period + 1):
        annual_noi = noi_year_1 * ((1 + noi_growth_rate) ** (year - 1))
        cash_flows.append(annual_noi)

    final_year_noi = noi_year_1 * ((1 + noi_growth_rate) ** hold_period)
    exit_value = final_year_noi / exit_cap_rate
    cash_flows[-1] += exit_value

    irr = calculate_irr_manual(cash_flows)
    total_cash_inflow = sum(cash_flows[1:])
    total_return = ((total_cash_inflow / purchase_price) - 1) * 100

    return {
        'irr_pct': irr * 100,
        'total_return_pct': total_return,
        'annual_cf_y1': noi_year_1,
        'exit_value': exit_value,
        'cash_flows': cash_flows,
    }
# --- end verbatim port ---


CASES = [
    ('standard',     {'purchase_price': 5_000_000, 'net_operating_income': 400_000, 'noi_growth_rate': 3.0,  'hold_period': 10, 'exit_cap_rate': 6.5}),
    ('high_growth',  {'purchase_price': 5_000_000, 'net_operating_income': 400_000, 'noi_growth_rate': 10.0, 'hold_period': 10, 'exit_cap_rate': 6.5}),
    ('low_growth',   {'purchase_price': 5_000_000, 'net_operating_income': 400_000, 'noi_growth_rate': 0.5,  'hold_period': 10, 'exit_cap_rate': 6.5}),
    ('short_hold',   {'purchase_price': 5_000_000, 'net_operating_income': 400_000, 'noi_growth_rate': 3.0,  'hold_period': 5,  'exit_cap_rate': 6.5}),
    ('long_hold',    {'purchase_price': 5_000_000, 'net_operating_income': 400_000, 'noi_growth_rate': 3.0,  'hold_period': 20, 'exit_cap_rate': 6.5}),
    ('high_cap',     {'purchase_price': 5_000_000, 'net_operating_income': 400_000, 'noi_growth_rate': 3.0,  'hold_period': 10, 'exit_cap_rate': 9.0}),
]


def main():
    out = []
    for name, inputs in CASES:
        result = calculate_irr_analysis(inputs)
        out.append({
            'name': name,
            'inputs': inputs,
            'irr_pct': result['irr_pct'],
            'total_return_pct': result['total_return_pct'],
            'annual_cf_y1': result['annual_cf_y1'],
            'exit_value': result['exit_value'],
            'cash_flows': result['cash_flows'],
        })
    print(json.dumps(out, indent=2))


if __name__ == '__main__':
    main()
