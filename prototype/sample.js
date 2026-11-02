'use strict';
/* Sample-data profiles: what "Try with sample data" looks like for someone in each country, by reporting currency.
   Names (banks, e-wallets, investment platforms, merchants, stocks) are local. Money is written in USD terms
   and scaled to the currency and the local price level (`pl`) when the sample is built (see seed() in app.js);
   the rupiah profile keeps its own rupiah amounts. A currency without a profile uses the USD one. */
(() => {
  // shared USD-scale numbers of the non-rupiah profiles (the rupiah ones divided by ~15,500)
  const BASE = {
    bal: [47900, 29400, 7600, 1700, 220, 80, 150],                   // 3 bank accounts, cash, 3 e-wallets
    salary: 2700, freelance: [420, 190], bill: 80, topup: [97, 65, 52],
    plan: [['Groceries', 5, 4, 42], ['Dining', 9, 1.5, 21], ['Transport', 8, 0.8, 18], ['Shopping', 2, 10, 115], ['Bills & Utilities', 3, 18, 80], ['Entertainment', 2, 3, 22], ['Health', 1, 6, 35]],
    budget: { total: 1420, Groceries: 195, Dining: 160, Transport: 115, Shopping: 195, Entertainment: 65, 'Bills & Utilities': 195 },
    trip: 970, lent: [1600, 320], card: [900, 160], cashA: 9700, cashB: 5500,
  };
  // global platform holdings shared by most profiles: [symbol, quantity]
  const GLOBAL = [['VOO', 35], ['AAPL', 40], ['NVDA', 80], ['BTC', 0.5], ['USDT', 12000], ['XAUG', 150]];
  // local stocks: [key, name, Yahoo symbol, USD price, USD value held, cost factor (1 = bought at today's price)]
  const mk = (o) => ({ unit: 'USD', ...BASE, global: GLOBAL, ...o });

  const SAMPLE = {};

  SAMPLE.IDR = {
    unit: 'IDR', pl: 1,
    names: ['BCA', 'Mandiri', 'Bank Jago', 'Cash', 'Gopay', 'ShopeePay', 'OVO'],
    bal: [742000000, 455000000, 118000000, 26000000, 3400000, 1250000, 2300000],
    salary: 42000000, freelance: [6500000, 3000000], bill: ['Indihome + Telkomsel', 1250000], topup: [1500000, 1000000, 800000],
    subs: [['Netflix', 186000, 'Entertainment/Streaming'], ['Spotify', 55000, 'Subscription']],
    plan: [
      ['Groceries', 5, 60000, 650000, ['Indomaret|Supermarket', 'Alfamart|Supermarket', 'Superindo|Supermarket', 'Pasar tradisional|Fresh market']],
      ['Dining', 9, 22000, 320000, ['Kopi Kenangan|Coffee', 'Warteg|Restaurants', 'Mie ayam|Restaurants', 'GoFood order|Delivery', 'Sate padang|Restaurants', 'Starbucks|Coffee']],
      ['Transport', 8, 12000, 280000, ['Gojek|Ride-hailing', 'Grab|Ride-hailing', 'Kartu KRL|Public transit', 'Pertamax|Fuel', 'Parkir']],
      ['Shopping', 2, 150000, 1800000, ['Tokopedia', 'Shopee', 'Uniqlo']],
      ['Bills & Utilities', 3, 280000, 1250000, ['Token listrik PLN', 'Indihome', 'Telkomsel', 'PDAM']],
      ['Entertainment', 2, 50000, 350000, ['CGV Cinema|Movies', 'Konser tiket|Events']],
      ['Health', 1, 90000, 550000, ['Kimia Farma', 'Gym membership']],
    ],
    budget: { total: 22000000, Groceries: 3000000, Dining: 2500000, Transport: 1800000, Shopping: 3000000, Entertainment: 1000000, 'Bills & Utilities': 3000000 },
    trip: ['Bali Trip', 15000000],
    loans: { home: [900000000, 9500000, 7.2], car: [190000000, 4500000, 6.5], card: [14000000, 2500000, 0] },
    lent: ['Budi', 25000000, 5000000, 'Business capital'],
    invest: { a: 'Stockbit', b: 'Ajaib', cashA: 150000000, cashB: 85000000 },
    stocks: [   // explicit: [key, name, Yahoo symbol, mult, price (USD), quantity, cost price (rupiah)]
      ['BBCA.JK', 'Bank Central Asia', 'BBCA.JK', 1, 9000 / 15500, 90000, 8400], ['BBRI.JK', 'Bank Rakyat Indonesia', 'BBRI.JK', 1, 4000 / 15500, 150000, 4350],
      ['BMRI.JK', 'Bank Mandiri', 'BMRI.JK', 1, 5000 / 15500, 60000, 4700], ['TLKM.JK', 'Telkom Indonesia', 'TLKM.JK', 1, 3000 / 15500, 70000, 3250],
    ],
    bStocks: [['ASII.JK', 'Astra International', 'ASII.JK', 1, 5000 / 15500, 30000, 4850]],
    global: [['VOO', 35], ['AAPL', 40], ['NVDA', 80], ['BTC', 0.5], ['USDT', 12000], ['XAUG', 150]],
    goldCost: 1480000, globalCost: { VOO: 470, AAPL: 190, NVDA: 98, BTC: 52000 },
  };

  SAMPLE.SGD = mk({
    pl: 1.1, names: ['DBS', 'OCBC', 'Trust Bank', 'Cash', 'GrabPay', 'PayLah!', 'YouTrip'],
    subs: [['Netflix', 13, 'Entertainment/Streaming'], ['Spotify', 7, 'Subscription']], bill: ['Singtel mobile & fibre', 75],
    plan: [
      ['Groceries', 5, 4, 42, ['FairPrice|Supermarket', 'Cold Storage|Supermarket', 'Sheng Siong|Supermarket', 'Wet market|Fresh market']],
      ['Dining', 9, 1.5, 21, ['Kopitiam|Restaurants', 'Ya Kun Kaya Toast|Coffee', 'Hawker centre|Restaurants', 'GrabFood|Delivery', 'Starbucks|Coffee', 'Din Tai Fung|Restaurants']],
      ['Transport', 8, 0.8, 18, ['MRT / bus (EZ-Link)|Public transit', 'Grab|Ride-hailing', 'Gojek|Ride-hailing', 'Shell petrol|Fuel', 'ERP & parking']],
      ['Shopping', 2, 10, 115, ['Shopee', 'Lazada', 'Uniqlo']], ['Bills & Utilities', 3, 18, 80, ['SP Services utilities', 'Singtel mobile & fibre', 'PUB water']],
      ['Entertainment', 2, 3, 22, ['Golden Village|Movies', 'Sistic tickets|Events']], ['Health', 1, 6, 35, ['Guardian pharmacy', 'ActiveSG gym']],
    ],
    trip: ['Bali Trip', 970], lentName: 'Wei Ming', home: [330000, 3.2], car: [24000, 2.8],
    invest: { a: 'Tiger Brokers', b: 'moomoo' },
    stocks: [['D05.SI', 'DBS Group', 'D05.SI', 27, 52000, 0.86], ['O39.SI', 'OCBC Bank', 'O39.SI', 10, 39000, 1.07], ['U11.SI', 'United Overseas Bank', 'U11.SI', 21, 19000, 0.93], ['Z74.SI', 'Singtel', 'Z74.SI', 2.4, 14000, 1.12]],
  });

  SAMPLE.HKD = mk({
    pl: 1.15, names: ['HSBC', 'Hang Seng Bank', 'Mox Bank', 'Cash', 'Octopus', 'AlipayHK', 'PayMe'],
    subs: [['Netflix', 11, 'Entertainment/Streaming'], ['Spotify', 6, 'Subscription']], bill: ['HKT mobile & broadband', 75],
    plan: [
      ['Groceries', 5, 4, 42, ['ParknShop|Supermarket', 'Wellcome|Supermarket', 'Market Place by Jasons|Supermarket', 'Wet market|Fresh market']],
      ['Dining', 9, 1.5, 21, ['Cha chaan teng|Restaurants', 'Tai Hing|Restaurants', 'Pacific Coffee|Coffee', 'Deliveroo|Delivery', 'Foodpanda|Delivery', 'Tim Ho Wan|Restaurants']],
      ['Transport', 8, 0.8, 18, ['MTR (Octopus)|Public transit', 'Bus (Octopus)|Public transit', 'Uber|Ride-hailing', 'Taxi|Ride-hailing', 'Tunnel & parking']],
      ['Shopping', 2, 10, 115, ['HKTVmall', 'Taobao', 'Uniqlo']], ['Bills & Utilities', 3, 18, 80, ['CLP electricity', 'HKT mobile & broadband', 'Water bill']],
      ['Entertainment', 2, 3, 22, ['UA Cinemas|Movies', 'Concert tickets|Events']], ['Health', 1, 6, 35, ['Watsons', 'Gym membership']],
    ],
    trip: ['Tokyo Trip', 1100], lentName: 'Ka Ming', home: [620000, 3.8], car: [30000, 3.2],
    invest: { a: 'Futu (moomoo)', b: 'Interactive Brokers' },
    stocks: [['0700.HK', 'Tencent', '0700.HK', 50, 52000, 0.86], ['0005.HK', 'HSBC Holdings', '0005.HK', 9.5, 39000, 1.07], ['1299.HK', 'AIA Group', '1299.HK', 8.5, 19000, 0.93], ['9988.HK', 'Alibaba Group', '9988.HK', 11, 14000, 1.12]],
  });

  SAMPLE.JPY = mk({
    pl: 0.85, names: ['MUFG Bank', 'Mizuho Bank', 'Rakuten Bank', 'Cash', 'PayPay', 'Suica', 'Rakuten Pay'],
    subs: [['Netflix', 9, 'Entertainment/Streaming'], ['Amazon Prime', 4, 'Subscription']], bill: ['Docomo + fibre', 60],
    plan: [
      ['Groceries', 5, 4, 42, ['Seiyu|Supermarket', 'Life|Supermarket', 'Aeon|Supermarket', 'Local market|Fresh market']],
      ['Dining', 9, 1.5, 21, ['Sukiya|Restaurants', 'Matsuya|Restaurants', 'Doutor|Coffee', 'Starbucks|Coffee', 'Uber Eats|Delivery', 'Ramen|Restaurants']],
      ['Transport', 8, 0.8, 18, ['Suica top-up|Public transit', 'JR train|Public transit', 'Taxi|Ride-hailing', 'Parking']],
      ['Shopping', 2, 10, 115, ['Amazon.co.jp', 'Rakuten Ichiba', 'Uniqlo']], ['Bills & Utilities', 3, 18, 80, ['Tokyo Electric', 'Tokyo Gas', 'Docomo + fibre']],
      ['Entertainment', 2, 3, 22, ['TOHO Cinemas|Movies', 'Live tickets|Events']], ['Health', 1, 6, 35, ['Matsumoto Kiyoshi', 'Gym membership']],
    ],
    trip: ['Hokkaido Trip', 900], lentName: 'Kenji', home: [230000, 1.4], car: [14000, 2.2],
    invest: { a: 'SBI Securities', b: 'Rakuten Securities' },
    stocks: [['7203.T', 'Toyota Motor', '7203.T', 15, 52000, 0.86], ['6758.T', 'Sony Group', '6758.T', 20, 39000, 1.07], ['8306.T', 'Mitsubishi UFJ', '8306.T', 11, 19000, 0.93], ['9984.T', 'SoftBank Group', '9984.T', 50, 14000, 1.12]],
  });

  SAMPLE.USD = mk({
    pl: 1, names: ['Chase', 'Bank of America', 'Ally Bank', 'Cash', 'Venmo', 'Cash App', 'PayPal'],
    subs: [['Netflix', 15, 'Entertainment/Streaming'], ['Spotify', 11, 'Subscription']], bill: ['Verizon + internet', 110],
    plan: [
      ['Groceries', 5, 12, 120, ['Walmart|Supermarket', 'Trader Joe\'s|Supermarket', 'Costco|Supermarket', 'Farmers market|Fresh market']],
      ['Dining', 9, 4, 55, ['Chipotle|Restaurants', 'Starbucks|Coffee', 'Dunkin\'|Coffee', 'DoorDash|Delivery', 'Uber Eats|Delivery', 'Local diner|Restaurants']],
      ['Transport', 8, 2, 60, ['Uber|Ride-hailing', 'Lyft|Ride-hailing', 'Shell gas|Fuel', 'Metro card|Public transit', 'Parking']],
      ['Shopping', 2, 20, 180, ['Amazon', 'Target', 'Nike']], ['Bills & Utilities', 3, 35, 150, ['Electric bill', 'Verizon + internet', 'Water & sewer']],
      ['Entertainment', 2, 8, 60, ['AMC Theatres|Movies', 'Ticketmaster|Events']], ['Health', 1, 12, 80, ['CVS Pharmacy', 'Planet Fitness']],
    ],
    trip: ['Hawaii Trip', 1500], lentName: 'Mike', home: [320000, 6.4], car: [26000, 6],
    invest: { a: 'Fidelity', b: 'Coinbase' }, catalogA: [['VOO', 120], ['AAPL', 150], ['MSFT', 60], ['NVDA', 80]], global: [['BTC', 0.5], ['ETH', 6], ['USDT', 12000], ['XAUG', 150]],
    stocks: [],
  });

  SAMPLE.EUR = mk({
    pl: 0.95, names: ['ING', 'Deutsche Bank', 'N26', 'Cash', 'PayPal', 'Revolut', 'Wise'],
    subs: [['Netflix', 13, 'Entertainment/Streaming'], ['Spotify', 11, 'Subscription']], bill: ['Telekom mobile & internet', 70],
    plan: [
      ['Groceries', 5, 4, 42, ['Lidl|Supermarket', 'REWE|Supermarket', 'Carrefour|Supermarket', 'Weekly market|Fresh market']],
      ['Dining', 9, 1.5, 21, ['Bäckerei|Coffee', 'Café|Coffee', 'Döner|Restaurants', 'Lieferando|Delivery', 'Trattoria|Restaurants', 'Starbucks|Coffee']],
      ['Transport', 8, 0.8, 18, ['Deutsche Bahn|Public transit', 'Monthly transit pass|Public transit', 'Uber|Ride-hailing', 'Shell fuel|Fuel', 'Parking']],
      ['Shopping', 2, 10, 115, ['Amazon', 'Zalando', 'H&M']], ['Bills & Utilities', 3, 18, 80, ['Electricity', 'Telekom mobile & internet', 'Water']],
      ['Entertainment', 2, 3, 22, ['Cinemaxx|Movies', 'Concert tickets|Events']], ['Health', 1, 6, 35, ['Apotheke', 'Gym membership']],
    ],
    trip: ['Lisbon Trip', 1000], lentName: 'Marco', home: [290000, 3.4], car: [22000, 3.6],
    invest: { a: 'Trade Republic', b: 'Interactive Brokers' },
    stocks: [['ASML.AS', 'ASML Holding', 'ASML.AS', 700, 52000, 0.86], ['SAP.DE', 'SAP', 'SAP.DE', 240, 39000, 1.07], ['SIE.DE', 'Siemens', 'SIE.DE', 190, 19000, 0.93], ['MC.PA', 'LVMH', 'MC.PA', 700, 14000, 1.12]],
  });

  SAMPLE.GBP = mk({
    pl: 0.9, names: ['Barclays', 'Lloyds Bank', 'Monzo', 'Cash', 'PayPal', 'Revolut', 'Wise'],
    subs: [['Netflix', 11, 'Entertainment/Streaming'], ['Spotify', 12, 'Subscription']], bill: ['EE mobile & broadband', 70],
    plan: [
      ['Groceries', 5, 4, 42, ['Tesco|Supermarket', 'Sainsbury\'s|Supermarket', 'Aldi|Supermarket', 'Farmers market|Fresh market']],
      ['Dining', 9, 1.5, 21, ['Pret A Manger|Coffee', 'Costa Coffee|Coffee', 'Greggs|Restaurants', 'Deliveroo|Delivery', 'Local pub|Restaurants', 'Nando\'s|Restaurants']],
      ['Transport', 8, 0.8, 18, ['TfL (contactless)|Public transit', 'National Rail|Public transit', 'Uber|Ride-hailing', 'BP fuel|Fuel', 'Parking']],
      ['Shopping', 2, 10, 115, ['Amazon UK', 'ASOS', 'Next']], ['Bills & Utilities', 3, 18, 80, ['Octopus Energy', 'EE mobile & broadband', 'Thames Water']],
      ['Entertainment', 2, 3, 22, ['Odeon|Movies', 'Concert tickets|Events']], ['Health', 1, 6, 35, ['Boots', 'PureGym']],
    ],
    trip: ['Edinburgh Weekend', 700], lentName: 'James', home: [300000, 4.6], car: [20000, 5.2],
    invest: { a: 'Hargreaves Lansdown', b: 'Trading 212' },
    stocks: [['HSBA.L', 'HSBC Holdings', 'HSBA.L', 11, 52000, 0.86, 0.01], ['SHEL.L', 'Shell', 'SHEL.L', 34, 39000, 1.07, 0.01], ['AZN.L', 'AstraZeneca', 'AZN.L', 155, 19000, 0.93, 0.01], ['ULVR.L', 'Unilever', 'ULVR.L', 60, 14000, 1.12, 0.01]],
  });

  SAMPLE.AUD = mk({
    pl: 1.05, names: ['CommBank', 'ANZ', 'UBank', 'Cash', 'PayPal', 'Wise', 'Revolut'],
    subs: [['Netflix', 12, 'Entertainment/Streaming'], ['Spotify', 9, 'Subscription']], bill: ['Telstra mobile & NBN', 80],
    plan: [
      ['Groceries', 5, 4, 42, ['Woolworths|Supermarket', 'Coles|Supermarket', 'Aldi|Supermarket', 'Farmers market|Fresh market']],
      ['Dining', 9, 1.5, 21, ['Flat white|Coffee', 'Gloria Jean\'s|Coffee', 'Menulog|Delivery', 'Uber Eats|Delivery', 'Pub lunch|Restaurants', 'Bakery|Restaurants']],
      ['Transport', 8, 0.8, 18, ['Opal / Myki|Public transit', 'Uber|Ride-hailing', 'DiDi|Ride-hailing', 'Ampol fuel|Fuel', 'Parking']],
      ['Shopping', 2, 10, 115, ['Kmart', 'Amazon AU', 'JB Hi-Fi']], ['Bills & Utilities', 3, 18, 80, ['AGL electricity', 'Telstra mobile & NBN', 'Water bill']],
      ['Entertainment', 2, 3, 22, ['Hoyts|Movies', 'Ticketek|Events']], ['Health', 1, 6, 35, ['Chemist Warehouse', 'Gym membership']],
    ],
    trip: ['Bali Trip', 1000], lentName: 'Jack', home: [480000, 5.8], car: [26000, 6.5],
    invest: { a: 'CommSec', b: 'Stake' },
    stocks: [['CBA.AX', 'Commonwealth Bank', 'CBA.AX', 115, 52000, 0.86], ['BHP.AX', 'BHP Group', 'BHP.AX', 30, 39000, 1.07], ['CSL.AX', 'CSL', 'CSL.AX', 190, 19000, 0.93], ['WES.AX', 'Wesfarmers', 'WES.AX', 52, 14000, 1.12]],
  });

  SAMPLE.CNY = mk({
    pl: 0.7, names: ['ICBC', 'China Merchants Bank', 'Bank of China', 'Cash', 'Alipay', 'WeChat Pay', 'Meituan Pay'],
    subs: [['Tencent Video', 5, 'Entertainment/Streaming'], ['NetEase Cloud Music', 3, 'Subscription']], bill: ['China Mobile + broadband', 40],
    plan: [
      ['Groceries', 5, 4, 42, ['Hema Fresh|Supermarket', 'Walmart China|Supermarket', 'Yonghui|Supermarket', 'Wet market|Fresh market']],
      ['Dining', 9, 1.5, 21, ['Luckin Coffee|Coffee', 'Starbucks|Coffee', 'Meituan Waimai|Delivery', 'Ele.me|Delivery', 'Hotpot|Restaurants', 'Noodle shop|Restaurants']],
      ['Transport', 8, 0.8, 18, ['Metro|Public transit', 'DiDi|Ride-hailing', 'Bike share|Public transit', 'Sinopec fuel|Fuel', 'Parking']],
      ['Shopping', 2, 10, 115, ['Taobao', 'JD.com', 'Pinduoduo']], ['Bills & Utilities', 3, 18, 80, ['State Grid electricity', 'China Mobile + broadband', 'Water & gas']],
      ['Entertainment', 2, 3, 22, ['Wanda Cinemas|Movies', 'Concert tickets|Events']], ['Health', 1, 6, 35, ['Pharmacy', 'Gym membership']],
    ],
    trip: ['Chengdu Trip', 800], lentName: 'Li Wei', home: [260000, 3.6], car: [20000, 4],
    invest: { a: 'Futu Niuniu', b: 'Tiger Brokers' },
    stocks: [['600519.SS', 'Kweichow Moutai', '600519.SS', 215, 52000, 0.86], ['300750.SZ', 'CATL', '300750.SZ', 35, 39000, 1.07], ['601318.SS', 'Ping An Insurance', '601318.SS', 7, 19000, 0.93], ['000858.SZ', 'Wuliangye', '000858.SZ', 17, 14000, 1.12]],
  });

  // fill in what every non-rupiah profile derives the same way: loans, the friend you lent to, opening prices of the global assets
  const pmt = (principal, rate, years) => { const r = rate / 1200, n = years * 12; return r ? (principal * r) / (1 - (1 + r) ** -n) : principal / n; };
  const USD_COST = { VOO: 470, AAPL: 190, MSFT: 380, NVDA: 98, BTC: 52000, ETH: 2800, XAUG: 94 };   // average buy prices in USD
  Object.entries(SAMPLE).forEach(([c, P]) => {
    if (c === 'IDR') return;
    P.loans = { home: [P.home[0], Math.round(pmt(P.home[0], P.home[1], 25)), P.home[1]], car: [P.car[0], Math.round(pmt(P.car[0], P.car[1], 5)), P.car[1]], card: [BASE.card[0], BASE.card[1], 0] };
    P.lent = [P.lentName, BASE.lent[0], BASE.lent[1], 'Loan to a friend'];
    P.cost = USD_COST;
  });

  // Per-country scenarios: special occasions of every kind (names and what was bought are local) and the fees a bank or broker charges
  // (bank transfer, e-wallet top-up, buying, selling). Fees: rupiah in IDR, USD-scale elsewhere (scaled like every other amount).
  // occ.stay / weekend / long / anniv: [occasion name, ...what it was spent on]; occ.birthday: an occasion with no dates and no budget.
  const EXTRA = {
    IDR: { fee: [6500, 1000, 9000, 11000], occ: {
      stay: ['Staycation Bandung', 'Hotel Santika', 'Makan malam Dago'], weekend: ['Liburan Yogyakarta', 'Hotel Malioboro', 'Tiket kereta KAI', 'Gudeg Yu Djum', 'Bakmi Jawa', 'Oleh-oleh bakpia'],
      long: ['Mudik & Liburan Panjang', 'Hotel di Surabaya', 'Tiket pesawat Garuda', 'Makan malam keluarga', 'Hadiah untuk keluarga', 'Makan siang perpisahan'], anniv: ['Makan malam Anniversary', 'Dinner di Plaza Indonesia'], birthday: 'Ulang Tahun Ibu' } },
    SGD: { fee: [2.2, 0.3, 1.3, 1.5], occ: {
      stay: ['Sentosa Staycation', 'Hotel on Sentosa', 'Dinner at RWS'], weekend: ['KL Weekend', 'Hotel in Bukit Bintang', 'KTM train tickets', 'Jalan Alor dinner', 'Nasi lemak lunch', 'Pasar Seni souvenirs'],
      long: ['Japan Holiday', 'Hotel in Osaka', 'Scoot flights', 'Dotonbori dinner', 'Gifts for family', 'Farewell ramen lunch'], anniv: ['Anniversary dinner', 'Dinner at Marina Bay'], birthday: "Mum's Birthday" } },
    HKD: { fee: [2.6, 0.4, 1.4, 1.6], occ: {
      stay: ['Cheung Chau Staycation', 'Seaside guesthouse', 'Seafood dinner'], weekend: ['Macau Weekend', 'Hotel in Taipa', 'TurboJET ferry tickets', 'Portuguese dinner', 'Egg tart lunch', 'Pastry souvenirs'],
      long: ['Taiwan Holiday', 'Hotel in Taipei', 'Cathay flights', 'Shilin night market', 'Gifts for friends', 'Farewell dim sum'], anniv: ['Anniversary dinner', 'Dinner in Tsim Sha Tsui'], birthday: "Dad's Birthday" } },
    JPY: { fee: [1.6, 0.8, 5, 6], occ: {
      stay: ['Hakone Onsen Stay', 'Ryokan in Hakone', 'Kaiseki dinner'], weekend: ['Kyoto Weekend', 'Hotel in Gion', 'Shinkansen tickets', 'Kyoto ramen dinner', 'Matcha lunch', 'Yatsuhashi souvenirs'],
      long: ['Hokkaido Summer Trip', 'Hotel in Sapporo', 'ANA flights', 'Sushi dinner', 'Omiyage for coworkers', 'Farewell seafood lunch'], anniv: ['Anniversary dinner', 'Dinner in Ginza'], birthday: "Dad's Birthday" } },
    USD: { fee: [2.5, 0.2, 1.2, 1.4], occ: {
      stay: ['Beach Staycation', 'Seaside hotel', 'Seafood dinner'], weekend: ['Nashville Weekend', 'Hotel downtown', 'Amtrak tickets', 'Hot chicken dinner', 'BBQ lunch', 'Souvenirs on Broadway'],
      long: ['Summer Road Trip', 'Motels on the road', 'Rental car', 'Diner dinner', 'Gifts for the family', 'Farewell brunch'], anniv: ['Anniversary dinner', 'Steakhouse dinner'], birthday: "Mom's Birthday" } },
    EUR: { fee: [2.2, 0.3, 1.1, 1.3], occ: {
      stay: ['Spa Staycation', 'Spa hotel', 'Dinner at the spa'], weekend: ['Paris Weekend', 'Hotel in Montmartre', 'Thalys tickets', 'Bistro dinner', 'Croissant lunch', 'Souvenirs at Montmartre'],
      long: ['Italy Holiday', 'Hotel in Rome', 'Ryanair flights', 'Trattoria dinner', 'Gifts for the family', 'Farewell pizza lunch'], anniv: ['Anniversary dinner', 'Dinner in the old town'], birthday: "Mama's Birthday" } },
    GBP: { fee: [2.4, 0.3, 1.2, 1.4], occ: {
      stay: ['Brighton Staycation', 'Seafront hotel', 'Fish and chips dinner'], weekend: ['Edinburgh Weekend', 'Hotel on the Royal Mile', 'LNER train tickets', 'Haggis dinner', 'Pub lunch', 'Tartan souvenirs'],
      long: ['Cornwall Holiday', 'Cottage in St Ives', 'Rental car', 'Pasty dinner', 'Gifts for the family', 'Farewell cream tea'], anniv: ['Anniversary dinner', 'Dinner in Soho'], birthday: "Mum's Birthday" } },
    AUD: { fee: [2.3, 0.3, 1.2, 1.4], occ: {
      stay: ['Gold Coast Staycation', 'Beachfront hotel', 'Seafood dinner'], weekend: ['Melbourne Weekend', 'Hotel on Collins St', 'V/Line train tickets', 'Laneway dinner', 'Flat white and brunch', 'Souvenirs at Queen Vic Market'],
      long: ['Tasmania Holiday', 'Cabin in Cradle Mountain', 'Rental car', 'Pub dinner', 'Gifts for the family', 'Farewell fish and chips'], anniv: ['Anniversary dinner', 'Dinner in Fitzroy'], birthday: "Mum's Birthday" } },
    CNY: { fee: [2.0, 0.2, 1.0, 1.2], occ: {
      stay: ['Hangzhou Staycation', 'Hotel by West Lake', 'Dinner at Lou Wai Lou'], weekend: ['Chengdu Weekend', 'Hotel on Chunxi Road', 'High-speed rail tickets', 'Hotpot dinner', 'Dan dan noodles lunch', 'Panda souvenirs'],
      long: ['Yunnan Holiday', 'Hotel in Lijiang', 'China Eastern flights', 'Bai cuisine dinner', 'Gifts for the family', 'Farewell hotpot lunch'], anniv: ['Anniversary dinner', 'Dinner at the Bund'], birthday: "Mom's Birthday" } },
  };
  Object.entries(EXTRA).forEach(([c, x]) => Object.assign(SAMPLE[c], x));
  window.SAMPLE = SAMPLE;
})();
