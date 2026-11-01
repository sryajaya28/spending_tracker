-- Cost basis for investments: the currency a holding's prices are kept in, and the price per unit of each opening/buy/sell event.
-- Average price and P&L are computed in the app from these (weighted average cost).
alter table public.holdings add column cost_currency text;
alter table public.holdings add constraint holdings_cost_currency_chk check (cost_currency is null or length(cost_currency) = 3);
alter table public.holding_events add column unit_price numeric;
alter table public.holding_events add constraint holding_events_unit_price_chk check (unit_price is null or unit_price >= 0);
