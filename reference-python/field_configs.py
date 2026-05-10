# ==============================================================================
# config/field_configs.py
# ==============================================================================

from models.deal_data import FieldConfig

FIELD_CONFIGS = {
    'deal_name': FieldConfig(
        name='deal_name',
        prompt="What's the name of this deal?",
        field_type='string',
        required=True,
        description="A descriptive name for the real estate deal",
        examples=["Downtown Office Complex", "Main Street Shopping Center", "Sunrise Plaza"],
        common_formats=["Simple text", "Building name + location", "Address-based names"]
    ),
    'purchase_price': FieldConfig(
        name='purchase_price',
        prompt="What's the purchase price? (Enter amount in dollars)",
        field_type='currency',
        required=True,
        min_value=1,
        description="The total acquisition cost of the property in US dollars",
        examples=["$5,000,000", "5M", "5.5 million", "5500000"],
        common_formats=["With dollar sign", "With commas", "Abbreviated (M, K)", "Written out (million)"]
    ),
    'net_operating_income': FieldConfig(
        name='net_operating_income',
        prompt="What's the Net Operating Income (NOI)? (Enter amount in dollars)",
        field_type='currency',
        required=True,
        min_value=1,
        description="Annual net operating income after operating expenses but before debt service",
        examples=["$400,000", "400K", "four hundred thousand", "0.4M"],
        common_formats=["Dollar amounts", "Abbreviated with K/M", "Written out numbers"]
    ),
    'noi_growth_rate': FieldConfig(
        name='noi_growth_rate',
        prompt="What's the NOI growth rate? (Enter as percentage)",
        field_type='percentage',
        required=True,
        min_value=0,
        max_value=100,
        description="Expected annual growth rate of net operating income as a percentage",
        examples=["3.5%", "3.5", "three and a half percent", "3.5 percent annually"],
        common_formats=["With percent sign", "As decimal", "Written out", "With time period"]
    ),
    'hold_period': FieldConfig(
        name='hold_period',
        prompt="What's the hold period in years?",
        field_type='int',
        required=True,
        min_value=1,
        max_value=50,
        description="Number of years the property will be held before sale",
        examples=["10", "10 years", "10y", "ten years", "a decade"],
        common_formats=["Just number", "Number + years", "Number + y", "Written out"]
    ),
    'exit_cap_rate': FieldConfig(
        name='exit_cap_rate',
        prompt="What's the exit cap rate? (Enter as percentage)",
        field_type='percentage',
        required=True,
        min_value=0,
        max_value=100,
        description="Expected capitalization rate at time of sale as a percentage",
        examples=["6.5%", "6.5", "six and a half percent", "650 basis points"],
        common_formats=["Percentage", "Decimal", "Basis points", "Written out"]
    ),
    'city': FieldConfig(
        name='city',
        prompt="What city is the property located in? (Optional)",
        field_type='string',
        required=False,
        description="The city where the property is located",
        examples=["Los Angeles", "NYC", "San Francisco, CA", "Chicago, Illinois"],
        common_formats=["City name only", "City, State", "Abbreviations", "Full state names"]
    )
}

FIELD_ORDER = ['deal_name', 'purchase_price', 'net_operating_income', 
               'noi_growth_rate', 'hold_period', 'exit_cap_rate', 'city']