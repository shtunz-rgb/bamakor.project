import React, { useState, useEffect, useRef } from 'react';


const SUPABASE_URL = 'https://jbbyzzybclrpxpdledic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiYnl6enliY2xycHhwZGxlZGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDQ4NjYsImV4cCI6MjA4NDY4MDg2Nn0.ntsDu_3t4cw135XUVrw_dwqBAbsKr1Rp0U6UaqvM7iU';


const PROJECT_NAME = "במקור.פרוג׳קט";
const VERSION = "V.7.13 (Armageddon Update)";


const initialSettlements = [
 { id: "Q1218", name: "ירושלים", lat: 31.7683, lng: 35.2137 },
 { id: "Q33935", name: "תל אביב-יפו", lat: 32.0853, lng: 34.7818 },
 { id: "Q128560", name: "חיפה", lat: 32.7940, lng: 34.9896 },
 { id: "Q152438", name: "קריית אתא", lat: 32.8000, lng: 35.1000 },
 { id: "Q2421350", name: "קריית מוצקין", lat: 32.8333, lng: 35.0667 },
 { id: "Q2299216", name: "קריית ביאליק", lat: 32.8333, lng: 35.0833 },
 { id: "Q1664421", name: "קריית ים", lat: 32.8525, lng: 35.0719 },
 { id: "Q2530182", name: "קריית חיים", lat: 32.8300, lng: 35.0600 },
 { id: "Q152414", name: "קריית מלאכי", lat: 31.7264, lng: 34.7431 },
 { id: "Q167633", name: "נשר", lat: 32.7633, lng: 35.0394 },
 { id: "Q152409", name: "טירת כרמל", lat: 32.7611, lng: 34.9722 },
 { id: "Q192257", name: "אום אל-פחם", lat: 32.5197, lng: 35.1531 },
 { id: "Q152425", name: "אופקים", lat: 31.3142, lng: 34.6208 },
 { id: "Q152436", name: "אור יהודה", lat: 32.0306, lng: 34.8519 },
 { id: "Q167652", name: "אור עקיבא", lat: 32.4931, lng: 34.9189 },
 { id: "Q134762", name: "אילת", lat: 29.5577, lng: 34.9519 },
 { id: "Q170642", name: "אשדוד", lat: 31.8044, lng: 34.6553 },
 { id: "Q170631", name: "אשקלון", lat: 31.6667, lng: 34.5667 },
 { id: "Q184450", name: "באר שבע", lat: 31.2519, lng: 34.7914 },
 { id: "Q152445", name: "בית שאן", lat: 32.4972, lng: 35.4972 },
 { id: "Q152442", name: "בית שמש", lat: 31.7456, lng: 34.9867 },
 { id: "Q152431", name: "בת ים", lat: 32.0167, lng: 34.7500 },
 { id: "Q928643", name: "גבעת שמואל", lat: 32.0786, lng: 34.8483 },
 { id: "Q152433", name: "גבעתיים", lat: 32.0722, lng: 34.8103 },
 { id: "Q2344738", name: "גני תקווה", lat: 32.0614, lng: 34.8731 },
 { id: "Q152413", name: "דימונה", lat: 31.0667, lng: 35.0333 },
 { id: "Q152424", name: "הוד השרון", lat: 32.1525, lng: 34.8919 },
 { id: "Q38612", name: "הרצליה", lat: 32.1653, lng: 34.8458 },
 { id: "Q152434", name: "חדרה", lat: 32.4358, lng: 34.9139 },
 { id: "Q152416", name: "חולון", lat: 32.0167, lng: 34.7667 },
 { id: "Q152426", name: "טבריה", lat: 32.7897, lng: 35.5353 },
 { id: "Q192253", name: "טייבה", lat: 32.2647, lng: 35.0083 },
 { id: "Q259920", name: "טירה", lat: 32.2344, lng: 34.9292 },
 { id: "Q152419", name: "טמרה", lat: 32.8544, lng: 35.1978 },
 { id: "Q152435", name: "יבנה", lat: 31.8778, lng: 34.7394 },
 { id: "Q2633008", name: "יהוד-מונוסון", lat: 32.0319, lng: 34.8886 },
 { id: "Q152421", name: "יקנעם עילית", lat: 32.6644, lng: 35.1086 },
 { id: "Q167582", name: "יקנעם", lat: 32.6602, lng: 35.1046 },
 { id: "Q2633013", name: "כפר יונה", lat: 32.3217, lng: 34.9283 },
 { id: "Q152428", name: "כפר סבא", lat: 32.1750, lng: 34.9069 },
 { id: "Q193657", name: "כפר קאסם", lat: 32.1136, lng: 34.9753 },
 { id: "Q193630", name: "כפר קרע", lat: 32.5021, lng: 35.0457 },
 { id: "Q152417", name: "כרמיאל", lat: 32.9139, lng: 35.2961 },
 { id: "Q152427", name: "לוד", lat: 31.9511, lng: 34.8936 },
 { id: "Q152412", name: "מגדל העמק", lat: 32.6739, lng: 35.2411 },
 { id: "Q170624", name: "מודיעין-מכבים-רעות", lat: 31.9078, lng: 35.0069 },
 { id: "Q206012", name: "מעלה אדומים", lat: 31.7797, lng: 35.3003 },
 { id: "Q152411", name: "מעלות-תרשיחא", lat: 33.0136, lng: 35.2694 },
 { id: "Q152429", name: "נהריה", lat: 33.0064, lng: 35.0939 },
 { id: "Q167645", name: "נוף הגליל", lat: 32.7056, lng: 35.3039 },
 { id: "Q152439", name: "נס ציונה", lat: 31.9289, lng: 34.8011 },
 { id: "Q185527", name: "נצרת", lat: 32.7019, lng: 35.3033 },
 { id: "Q2299214", name: "נתיבות", lat: 31.4222, lng: 34.5889 },
 { id: "Q152407", name: "נתניה", lat: 32.3294, lng: 34.8567 },
 { id: "Q152422", name: "סח'נין", lat: 32.8631, lng: 35.3014 },
 { id: "Q152441", name: "עכו", lat: 32.9278, lng: 35.0817 },
 { id: "Q152430", name: "עפולה", lat: 32.6078, lng: 35.2894 },
 { id: "Q193665", name: "עראבה", lat: 32.8553, lng: 35.3342 },
 { id: "Q152408", name: "ערד", lat: 31.2611, lng: 35.2150 },
 { id: "Q170535", name: "פתח תקווה", lat: 32.0889, lng: 34.8864 },
 { id: "Q188929", name: "צפת", lat: 32.9658, lng: 35.4983 },
 { id: "Q2424151", name: "קלנסווה", lat: 32.2883, lng: 35.0397 },
 { id: "Q152423", name: "קריית אונו", lat: 32.0636, lng: 34.8553 },
 { id: "Q167644", name: "קריית גת", lat: 31.6061, lng: 34.7633 },
 { id: "Q152410", name: "קריית שמונה", lat: 33.2078, lng: 35.5694 },
 { id: "Q152443", name: "ראש העין", lat: 32.0967, lng: 34.9572 },
 { id: "Q184281", name: "ראשון לציון", lat: 31.9711, lng: 34.8042 },
 { id: "Q192258", name: "רהט", lat: 31.3922, lng: 34.7547 },
 { id: "Q170609", name: "רחובות", lat: 31.8947, lng: 34.8114 },
 { id: "Q152418", name: "רמת גן", lat: 32.0700, lng: 34.8236 },
 { id: "Q152440", name: "רמת השרון", lat: 32.1400, lng: 34.8300 },
 { id: "Q152415", name: "רעננה", lat: 32.1847, lng: 34.8708 },
 { id: "Q167641", name: "שדרות", lat: 31.5239, lng: 34.5953 },
 { id: "Q193649", name: "שפרעם", lat: 32.8056, lng: 35.1722 },
 { id: "Q2889241", name: "גבעת השלושה", lat: 32.1008, lng: 34.9142 },
 { id: "Q1025582", name: "נחשולים", lat: 32.6108, lng: 34.9225 },
 { id: "Q2915352", name: "פורדיס", lat: 32.5936, lng: 34.9506 },
 { id: "Q2908272", name: "עינת", lat: 32.0833, lng: 34.9333 },
 { id: "Q2889279", name: "משמרות", lat: 32.4891, lng: 34.9861 },
 { id: "Q170558", name: "בני ברק", lat: 32.0833, lng: 34.8333 },
 { id: "Q1142512", name: "ראש הנקרה", lat: 33.0906, lng: 35.1058 },
 { id: "Q2292376", name: "רכסים", lat: 32.7483, lng: 35.0933 },
 { id: "Q2299211", name: "רמת ישי", lat: 32.7056, lng: 35.1667 },
 { id: "Q1240656", name: "הזורע", lat: 32.6433, lng: 35.1219 },
 { id: "Q167646", name: "קריית טבעון", lat: 32.7119, lng: 35.1297 },
 { id: "Q2592532", name: "נופית", lat: 32.7381, lng: 35.1389 },
 { id: "Q192254", name: "עספיא", lat: 32.7207, lng: 35.0591 },
 { id: "Q2298642", name: "דלית אל-כרמל", lat: 32.6953, lng: 35.0483 },
 { id: "Q1134017", name: "נהלל", lat: 32.6903, lng: 35.1956 },
 { id: "Q2569562", name: "עתלית", lat: 32.6869, lng: 34.9378 },
 { id: "Q152432", name: "ירוחם", lat: 30.9872, lng: 34.9310 },
 { id: "Q1012117", name: "מצפה רמון", lat: 30.6080, lng: 34.8010 },
 { id: "Q2890458", name: "נאות סמדר", lat: 30.0490, lng: 35.0210 },
 { id: "Q2891334", name: "גרופית", lat: 29.9320, lng: 35.0660 },
 { id: "Q2916568", name: "צופר", lat: 30.5520, lng: 35.2010 },
 { id: "Q1605331", name: "לוטן", lat: 29.9880, lng: 35.0830 },
 { id: "Q1025597", name: "יוטבתה", lat: 29.8940, lng: 35.0600 },
 { id: "Q1011500", name: "גדרה", lat: 31.8122, lng: 34.7780 },
 { id: "Q1011488", name: "מזכרת בתיה", lat: 31.8533, lng: 34.8467 },
 { id: "Q607316", name: "גבעת ברנר", lat: 31.8647, lng: 34.8039 },
 { id: "Q2916578", name: "נצר סירני", lat: 31.9161, lng: 34.8417 },
 { id: "Q2293444", name: "חולדה", lat: 31.8411, lng: 34.8867 },
 { id: "Q2889243", name: "אעבלין", lat: 32.8183, lng: 35.1883 },
 { id: "Q2909015", name: "כאוכב אבו אל-היג'א", lat: 32.8361, lng: 35.2503 },
 { id: "Q2890562", name: "רמת יוחנן", lat: 32.7936, lng: 35.1189 },
 { id: "Q2631580", name: "אבו סנאן", lat: 32.9575, lng: 35.1664 },
 { id: "Q1012130", name: "אבן יהודה", lat: 32.2683, lng: 34.8886 },
 { id: "Q1025556", name: "אזור", lat: 32.0250, lng: 34.8100 },
 { id: "Q830024", name: "בית דגן", lat: 31.9967, lng: 34.8294 },
 { id: "Q1011504", name: "סביון", lat: 32.0517, lng: 34.8778 },
 { id: "Q2424911", name: "פלמחים", lat: 31.9283, lng: 34.7472 },
 { id: "Q942621", name: "מטולה", lat: 33.2847, lng: 35.5808 },
 { id: "Q2915340", name: "קיבוץ דפנה", lat: 33.2356, lng: 35.6322 },
 { id: "Q2915152", name: "קיבוץ דן", lat: 33.2411, lng: 35.6547 },
 { id: "Q1025585", name: "כפר בלום", lat: 33.1764, lng: 35.6067 },
 { id: "Q2915508", name: "קיבוץ עמיר", lat: 33.1747, lng: 35.6117 },
 { id: "Q2292419", name: "שוהם", lat: 31.9461, lng: 34.9478 },
 { id: "Q1011506", name: "אלעד", lat: 32.0522, lng: 34.9494 },
 { id: "Q2342377", name: "ג'לג'וליה", lat: 32.1539, lng: 34.9547 },
 { id: "Q1025584", name: "קיבוץ גזר", lat: 31.8686, lng: 34.9192 },
 { id: "Q199122", name: "זכרון יעקב", lat: 32.5739, lng: 34.9511 },
 { id: "Q312641", name: "קיסריה", lat: 32.5000, lng: 34.9000 },
 { id: "Q2890533", name: "אושה", lat: 32.7965, lng: 35.1146 },
 { id: "Q2915357", name: "כפר המכבי", lat: 32.7915, lng: 35.1134 },
 { id: "Q2915494", name: "נחף", lat: 32.9303, lng: 35.3131 },
 { id: "Q2634861", name: "בית ג'ן", lat: 32.9664, lng: 35.4056 },
 { id: "Q2633004", name: "פקיעין", lat: 32.9778, lng: 35.3328 },
 { id: "Q2631586", name: "דיר אל-אסד", lat: 32.9239, lng: 35.2933 },
 { id: "Q173531", name: "שכם", lat: 32.2211, lng: 35.2597 },
 { id: "Q211153", name: "ג'נין", lat: 32.4614, lng: 35.3006 },
 { id: "Q986348", name: "קלקיליה", lat: 32.1914, lng: 34.9750 },
 { id: "Q386613", name: "טול כרם", lat: 32.3167, lng: 35.0333 },
 { id: "Q156364", name: "רמאללה", lat: 31.9029, lng: 35.2044 },
 { id: "Q168939", name: "חברון", lat: 31.5326, lng: 35.0998 },
 { id: "Q1017366", name: "קריית ארבע", lat: 31.5283, lng: 35.1206 },
 { id: "Q2891255", name: "כברי", lat: 33.0250, lng: 35.1417 },
 { id: "Q2889655", name: "מנות", lat: 33.0450, lng: 35.1825 },
 { id: "Q2415170", name: "שלומי", lat: 33.0722, lng: 35.1472 },
 { id: "Q2634863", name: "מעליא", lat: 33.0261, lng: 35.2483 },
 { id: "Q2633010", name: "פסוטה", lat: 33.0500, lng: 35.3056 },
 { id: "Q1182672", name: "דגניה א'", lat: 32.7075, lng: 35.5753 },
 { id: "Q1012648", name: "עין גדי", lat: 31.4589, lng: 35.3858 },
 { id: "Q1025584", name: "מעגן מיכאל", lat: 32.5594, lng: 34.9125 },
 { id: "Q922880", name: "עין חרוד איחוד", lat: 32.5578, lng: 35.3917 },
 { id: "Q1025587", name: "עין חרוד מאוחד", lat: 32.5592, lng: 35.3942 },
 { id: "Q1339887", name: "עין חרוד", lat: 32.5603, lng: 35.3908 },
 { id: "Q804505", name: "בארי", lat: 31.4244, lng: 34.4925 },
 { id: "Q2915494", name: "כפר עזה", lat: 31.4797, lng: 34.5247 },
 { id: "Q2907406", name: "ניר עוז", lat: 31.3353, lng: 34.4033 },
 { id: "Q1020050", name: "נחל עוז", lat: 31.4708, lng: 34.4817 },
 { id: "Q2920251", name: "שפיים", lat: 32.2239, lng: 34.8136 },
 { id: "Q1011496", name: "יגור", lat: 32.7489, lng: 35.0764 },
 { id: "Q1025575", name: "בית השיטה", lat: 32.5508, lng: 35.4386 },
 { id: "Q2889244", name: "חצרים", lat: 31.2383, lng: 34.7139 },
 { id: "Q1025595", name: "סאסא", lat: 33.0286, lng: 35.3942 },
 { id: "Q582414", name: "משמר העמק", lat: 32.6108, lng: 35.1436 },
 { id: "Q1012558", name: "קבוצת כנרת", lat: 32.7119, lng: 35.5714 },
 { id: "Q2777478", name: "תל קציר", lat: 32.7036, lng: 35.6133 },
 { id: "Q2890520", name: "משאבי שדה", lat: 31.0028, lng: 34.7867 },
 { id: "Q977053", name: "מזרע", lat: 32.6517, lng: 35.2975 },
 { id: "Q1020120", name: "נען", lat: 31.8792, lng: 34.8589 },
 { id: "Q1378850", name: "ניר דוד (תל עמל)", lat: 32.5025, lng: 35.4578 },
 { id: "Q1025580", name: "כפר גלעדי", lat: 33.2417, lng: 35.5794 },
 { id: "Q1011475", name: "שדה בוקר", lat: 30.8756, lng: 34.7933 },
 { id: "Q1025579", name: "יד מרדכי", lat: 31.5867, lng: 34.5583 },
 { id: "Q2889304", name: "חניתה", lat: 33.0856, lng: 35.1706 },
 { id: "Q1025596", name: "שדות ים", lat: 32.4842, lng: 34.8872 },
 { id: "Q2916576", name: "ניר עם", lat: 31.5233, lng: 34.5806 },
 { id: "Q1011494", name: "כפר בלום", lat: 33.1706, lng: 35.6078 },
 { id: "Q2889311", name: "גבת", lat: 32.6681, lng: 35.2189 },
 { id: "Q1025585", name: "מעוז חיים", lat: 32.4939, lng: 35.5494 },
 { id: "Q1011487", name: "מנרה", lat: 33.1978, lng: 35.5539 },
 { id: "Q2889274", name: "משמר השרון", lat: 32.3606, lng: 34.8967 },
 { id: "Q2908277", name: "גבעת חיים (איחוד)", lat: 32.3942, lng: 34.9333 },
 { id: "Q2909026", name: "גבעת חיים (מאוחד)", lat: 32.3956, lng: 34.9286 },
 { id: "Q2915152", name: "רמת הכובש", lat: 32.2289, lng: 34.9236 },
 { id: "Q2890675", name: "גליל ים", lat: 32.1558, lng: 34.8317 },
 { id: "Q2916573", name: "נחשון", lat: 31.8319, lng: 34.9314 },
 { id: "Q1025588", name: "צובה", lat: 31.7831, lng: 35.1278 },
 { id: "Q1025586", name: "מעלה החמישה", lat: 31.8128, lng: 35.1097 },
 { id: "Q2889269", name: "אשדות יעקב (איחוד)", lat: 32.6586, lng: 35.5847 },
 { id: "Q2891316", name: "אשדות יעקב (מאוחד)", lat: 32.6619, lng: 35.5828 },
 { id: "Q1025591", name: "רביבים", lat: 31.0450, lng: 34.7208 },
 { id: "Q2890518", name: "גבים", lat: 31.5161, lng: 34.5967 },
 { id: "Q1025589", name: "עין דור", lat: 32.6533, lng: 35.4217 },
 { id: "Q2915354", name: "כפר חסידים", lat: 32.7533, lng: 35.0933 },
 { id: "Q1025586", name: "יגור", lat: 32.7483, lng: 35.0764 },
 { id: "Q2411986", name: "מע'אר", lat: 32.8906, lng: 35.4086 },
 { id: "Q2777868", name: "מג'ד אל-כרום", lat: 32.9214, lng: 35.2158 },
 { id: "Q2292372", name: "כפר כמא", lat: 32.7214, lng: 35.4394 },
 { id: "Q1012111", name: "קצרין", lat: 32.9908, lng: 35.6908 },
 { id: "Q383280", name: "אפיקים", lat: 32.6806, lng: 35.5803 },
 { id: "Q2292358", name: "ג'דידה-מכר", lat: 32.9250, lng: 35.1550 },
 { id: "Q2631584", name: "ג'וליס", lat: 32.9442, lng: 35.1878 },
 { id: "Q1025559", name: "גוש חלב", lat: 33.0222, lng: 35.4486 },
 { id: "Q1011502", name: "כפר ורדים", lat: 32.9864, lng: 35.2281 },
 { id: "Q2891331", name: "איילת השחר", lat: 33.0233, lng: 35.5786 },
 { id: "Q152420", name: "עמוקה", lat: 32.9977, lng: 35.5248 },
 { id: "Q2890531", name: "שדה אליעזר", lat: 33.0511, lng: 35.5678 },
 { id: "Q1011508", name: "תמרת", lat: 32.7058, lng: 35.2158 },
 { id: "Q2592534", name: "עין מאהל", lat: 32.7067, lng: 35.3486 },
 { id: "Q193652", name: "כפר כנא", lat: 32.7456, lng: 35.3386 },
 { id: "Q193635", name: "טורעאן", lat: 32.7725, lng: 35.3711 },
 { id: "Q2293437", name: "אליכין", lat: 32.4069, lng: 34.9167 },
 { id: "Q2890508", name: "אליקים", lat: 32.6311, lng: 35.0747 },
 { id: "Q2889272", name: "בנימינה", lat: 32.5186, lng: 34.9458 },
 { id: "Q2916818", name: "רמות מנשה", lat: 32.5833, lng: 35.1333 },
 { id: "Q835158", name: "סלפית", lat: 32.0833, lng: 35.1833 },
 { id: "Q1012134", name: "קדימה-צורן", lat: 32.2789, lng: 34.9131 },
 { id: "Q2292374", name: "נורדיה", lat: 32.3167, lng: 34.8967 },
 { id: "Q1025590", name: "תל יצחק", lat: 32.2514, lng: 34.8603 },
 { id: "Q2915346", name: "בצרה", lat: 32.2197, lng: 34.8725 },
 { id: "Q2915331", name: "רשפון", lat: 32.2019, lng: 34.8247 },
 { id: "Q928545", name: "יבנאל", lat: 32.7111, lng: 35.5039 },
 { id: "Q2920013", name: "אודים", lat: 32.2669, lng: 34.8470 },
 { id: "Q1525069", name: "גינוסר", lat: 32.8487, lng: 35.5232 },
 { id: "Q924849", name: "גן יבנה", lat: 31.783056, lng: 34.703101 },
 { id: "Q2900562", name: "בית אלפא", lat: 32.5117858, lng: 35.4328618 },
 { id: "Q546343", name: "חפציבה", lat: 32.5187, lng: 35.4262 },
 { id: "Q670612", name: "מג'דל שמס", lat: 33.2655, lng: 35.7697 },
 { id: "Q2573500", name: "בית זרע", lat: 32.688, lng: 35.5736 },
 { id: "Q2655024", name: "חורפיש", lat: 33.0167, lng: 35.3471 },
 { id: "Q2640151", name: "ירכא", lat: 32.9535, lng: 35.2120 },
 { id: "Q525649", name: "ראש פינה", lat: 32.9690, lng: 35.5429 },
 { id: "Q2907364", name: "חד נס", lat: 32.9275, lng: 35.6414 },
 { id: "Q2160189", name: "קדומים", lat: 32.2124, lng: 35.1574 },
 { id: "Q2588837", name: "חצור הגלילית", lat: 32.9804, lng: 35.5435 },
 { id: "Q2891272", name: "היוגב", lat: 32.612753, lng: 35.207483 },
 { id: "Q2890663", name: "גבעת עוז", lat: 32.5559, lng: 35.1980 },
 { id: "Q2475182", name: "פרדס חנה-כרכור", lat: 32.4728, lng: 34.9742 },
 { id: "Q2915523", name: "בוקעאתא", lat: 33.2027, lng: 35.7768 },
 { id: "Q25492963", name: "נחלת יהודה", lat: 31.5858, lng: 34.4825},
 { id: "Q1297", name: "שיקגו", lat: 41.8832, lng: 287.6324 }
];


const App = () => {
 const [searchQuery, setSearchQuery] = useState('');
 const [suggestions, setSuggestions] = useState([]);
 const [searchError, setSearchError] = useState(false);
 const [selectedSettlement, setSelectedSettlement] = useState(null);
 const [settlementSummary, setSettlementSummary] = useState('');
 const [people, setPeople] = useState([]);
 const [isLoading, setIsLoading] = useState(false);
 const [isSidebarOpen, setIsSidebarOpen] = useState(false);
 const [supabaseClient, setSupabaseClient] = useState(null);
 const [highlightedPersonId, setHighlightedPersonId] = useState(null);
  const mapRef = useRef(null);
 const leafletMapRef = useRef(null);
 const markersRef = useRef([]);
 const personRefs = useRef({});


 useEffect(() => {
   const script = document.createElement('script');
   script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
   script.async = true;
   script.onload = () => {
     if (window.supabase) {
       setSupabaseClient(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
     }
   };
   document.body.appendChild(script);
 }, []);


 useEffect(() => {
   if (!mapRef.current || leafletMapRef.current) return;


   const loadLeaflet = async () => {
     const link = document.createElement('link');
     link.rel = 'stylesheet';
     link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
     document.head.appendChild(link);


     const script = document.createElement('script');
     script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
     script.async = true;
     script.onload = () => {
       const L = window.L;
       const map = L.map(mapRef.current, { zoomControl: false, scrollWheelZoom: true }).setView([31.7, 35.0], 9);
       leafletMapRef.current = map;


       L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
         attribution: '© OpenStreetMap contributors'
       }).addTo(map);


       renderMarkers();
     };
     document.body.appendChild(script);
   };


   loadLeaflet();
 }, []);


 useEffect(() => {
   if (leafletMapRef.current) {
     renderMarkers();
   }
 }, [selectedSettlement]);


 const renderMarkers = () => {
   if (!leafletMapRef.current) return;
   const L = window.L;
   markersRef.current.forEach(m => m.remove());
   markersRef.current = [];


   initialSettlements.forEach(s => {
     const isSelected = selectedSettlement && s.id === selectedSettlement.id;


     if (isSelected) {
       const rippleIcon = L.divIcon({
         className: 'ripple-wrapper',
         html: '<div class="ripple-effect"></div>',
         iconSize: [40, 40],
         iconAnchor: [20, 20]
       });
       const rippleMarker = L.marker([s.lat, s.lng], { icon: rippleIcon, interactive: false }).addTo(leafletMapRef.current);
       markersRef.current.push(rippleMarker);
     }


     const marker = L.circleMarker([s.lat, s.lng], {
       radius: isSelected ? 9 : 7,
       fillColor: '#4f46e5',
       color: '#fff',
       weight: 2,
       fillOpacity: 0.9,
       interactive: true,
       zIndexOffset: isSelected ? 1000 : 0
     }).addTo(leafletMapRef.current);


     marker.on('click', () => {
       setHighlightedPersonId(null);
       handleSettlementSelection(s);
     });


     marker.bindTooltip(s.name, {
       direction: 'auto',
       sticky: true,
       className: 'custom-tooltip',
       opacity: 1
     });


     markersRef.current.push(marker);
   });
 };


 const handleSettlementSelection = (s) => {
   setSelectedSettlement(s);
   setSettlementSummary('');
   setIsSidebarOpen(true);
   fetchWikipediaSummary(s.name);
   if (leafletMapRef.current) {
     leafletMapRef.current.flyTo([s.lat, s.lng], 13);
   }
 };


 const fetchWikipediaSummary = async (settlementName) => {
   setSettlementSummary('טוען תיאור יישוב...');
   try {
     const endpoint = `https://he.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(settlementName)}`;
     const response = await fetch(endpoint);
     if (response.ok) {
       const data = await response.json();
       const fullText = data.extract || '';
       const sentences = fullText.split('. ');
       const shortText = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : '');
       setSettlementSummary(shortText || 'מידע ביוגרפי משולב');
     } else {
       setSettlementSummary('מידע ביוגרפי משולב');
     }
   } catch (e) {
     setSettlementSummary('מידע ביוגרפי משולב');
   }
 };


 useEffect(() => {
   const fetchSuggestions = async () => {
     const query = searchQuery.trim();
     if (query.length < 2) {
       setSuggestions([]);
       return;
     }


     const matchedSettlements = initialSettlements
       .filter(s => s.name.includes(query))
       .map(s => ({ ...s, type: 'settlement' }))
       .slice(0, 5);


     let matchedPersons = [];
     if (supabaseClient) {
       const { data } = await supabaseClient
         .from('persons')
         .select('id, full_name, wikidata_id, birth_place_raw, birth_place_by_wikidata')
         .ilike('full_name', `%${query}%`)
         .limit(5);
      
       if (data) {
         matchedPersons = data.map(p => ({ ...p, name: p.full_name, type: 'person' }));
       }
     }


     setSuggestions([...matchedSettlements, ...matchedPersons]);
   };


   const timer = setTimeout(fetchSuggestions, 300);
   return () => clearTimeout(timer);
 }, [searchQuery, supabaseClient]);


 const findLocationByWikidataId = async (qid) => {
   const sparql = `
     SELECT ?coord WHERE {
       wd:${qid} wdt:P19 ?birthPlace .
       ?birthPlace wdt:P625 ?coord .
     } LIMIT 1
   `;
   const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
   try {
     const res = await fetch(url);
     const data = await res.json();
     if (data.results.bindings.length > 0) {
       const point = data.results.bindings[0].coord.value;
       const match = point.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
       if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
     }
   } catch (e) { console.error("Wikidata fallback failed", e); }
   return null;
 };


 const handleSearchSubmit = async (e, forcedItem = null) => {
   if (e) e.preventDefault();
   const query = forcedItem ? forcedItem.name : searchQuery.trim();
   if (!query) return;


   setSuggestions([]);


   const settlement = initialSettlements.find(s => s.name === query);
   if (settlement) {
     setHighlightedPersonId(null);
     handleSettlementSelection(settlement);
     setSearchError(false);
     setSearchQuery('');
     return;
   }


   if (supabaseClient) {
     const { data } = await supabaseClient
       .from('persons')
       .select('*')
       .ilike('full_name', query)
       .limit(1);


     if (data && data.length > 0) {
       const person = data[0];
       setSearchError(false);
       setHighlightedPersonId(person.id);
      
       const birthCity = initialSettlements.find(s =>
         person.birth_place_raw?.includes(s.name) || person.birth_place_by_wikidata?.includes(s.name)
       );
      
       if (birthCity) {
         handleSettlementSelection(birthCity);
         setSearchQuery('');
         return;
       } else if (person.wikidata_id) {
         const coords = await findLocationByWikidataId(person.wikidata_id);
         if (coords && leafletMapRef.current) {
           leafletMapRef.current.flyTo([coords.lat, coords.lng], 13);
           const birthLabel = person.birth_place_raw || person.birth_place_by_wikidata || "מיקום לידה";
           setSelectedSettlement({ name: birthLabel, ...coords });
           setIsSidebarOpen(true);
           setSettlementSummary(birthLabel);
           setSearchQuery('');
           return;
         }
       }
      
       setSearchError('השם קיים במאגר, אך לא ניתן לשייך לו מיקום לידה');
       setTimeout(() => setSearchError(false), 5000);
       return;
     }
   }


   setSearchError(`השם "${query}" לא נמצא במאגר האישים או הערים שלנו`);
   setTimeout(() => setSearchError(false), 3000);
 };


 const fetchPeople = async (settlement) => {
   if (!supabaseClient) return;
   setIsLoading(true);
  
   try {
     const searchTerms = [settlement.name];
    
     if (settlement.name.includes('-')) {
       searchTerms.push(settlement.name.split('-')[0]);
     }
    
     if (settlement.name.startsWith('קריית ') || settlement.name.startsWith('קרית ')) {
       const baseName = settlement.name.replace(/^קרית\s|^קריית\s/, '');
       searchTerms.push(baseName);
     }


     const orConditions = searchTerms.flatMap(term => [
       `birth_place_raw.ilike.%${term}%`,
       `birth_place_by_wikidata.ilike.%${term}%`
     ]).join(',');


     const { data: dbData } = await supabaseClient
       .from('persons')
       .select('*')
       .or(orConditions);


     if (!dbData || dbData.length === 0) {
       setPeople([]);
       setIsLoading(false);
       return;
     }


     let workingList = [...dbData];


     if (highlightedPersonId) {
       const highlightedIndex = workingList.findIndex(p => p.id === highlightedPersonId);
       if (highlightedIndex > -1) {
         const [highlightedPerson] = workingList.splice(highlightedIndex, 1);
         workingList.unshift(highlightedPerson);
       }
     }


     const top50 = workingList.slice(0, 50);
     const others = workingList.slice(50);


     const qids = top50.map(p => p.wikidata_id).filter(id => id?.startsWith('Q'));
     let enrichedTop50 = top50;


     if (qids.length > 0) {
       // Updated SPARQL: Including P625 (Coordinate location) of the person's birth place
       const sparql = `
         SELECT ?item ?sitelinks ?image ?itemDescription ?coord (YEAR(?birth) AS ?birthYear) WHERE {
           VALUES ?item { ${qids.map(id => `wd:${id}`).join(' ')} }
           ?item wikibase:sitelinks ?sitelinks .
           OPTIONAL { ?item wdt:P18 ?image . }
           OPTIONAL { ?item wdt:P569 ?birth . }
           OPTIONAL {
             ?item wdt:P19 ?birthPlace .
             ?birthPlace wdt:P625 ?coord .
           }
           SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en". }
         }
       `;
      
       const wikiRes = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`);
       const wikiData = await wikiRes.json();
      
       const wikiMap = {};
       wikiData.results.bindings.forEach(row => {
         wikiMap[row.item.value.split('/').pop()] = {
           popularity: parseInt(row.sitelinks.value),
           image: row.image ? row.image.value : null,
           description: row.itemDescription ? row.itemDescription.value : null,
           birthYear: row.birthYear ? row.birthYear.value : null,
           coord: row.coord ? row.coord.value : null // Coordinate point e.g. "Point(34.8 32.1)"
         };
       });


       // Enrichment and SURGICAL GEOGRAPHIC FILTERING
       enrichedTop50 = top50.map(p => ({
         ...p,
         ...wikiMap[p.wikidata_id]
       })).filter(p => {
         // If we have coordinates from Wikidata, verify they are within Israel's bounding box
         if (p.coord) {
           const match = p.coord.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
           if (match) {
             const lng = parseFloat(match[1]);
             const lat = parseFloat(match[2]);
            
             // Israel Boundary Check: Lat 29.5 to 33.5, Lng 34.2 to 35.9
             const isInsideIsrael = (lat >= 29.5 && lat <= 33.5) && (lng >= 34.2 && lng <= 35.9);
            
             // If person is clearly outside Israel, filter them out (prevents global namesakes)
             if (!isInsideIsrael) return false;
           }
         }
         return true;
       }).sort((a, b) => {
         if (a.id === highlightedPersonId) return -1;
         if (b.id === highlightedPersonId) return 1;
         return (b.popularity || 0) - (a.popularity || 0);
       });
     }


     const finalResult = [...enrichedTop50, ...others];
     setPeople(finalResult);
   } catch (e) {
     console.error("Fetch failed in Armageddon mode:", e);
   } finally {
     setIsLoading(false);
   }
 };


 useEffect(() => {
   if (selectedSettlement) fetchPeople(selectedSettlement);
 }, [selectedSettlement]);


 useEffect(() => {
   if (!isLoading && highlightedPersonId && personRefs.current[highlightedPersonId]) {
     setTimeout(() => {
       personRefs.current[highlightedPersonId].scrollIntoView({
         behavior: 'smooth',
         block: 'center'
       });
     }, 500);
   }
 }, [isLoading, highlightedPersonId, people]);


 return (
   <div className="h-screen w-full flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden" dir="rtl">
     <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap justify-between items-center z-30 shadow-sm gap-4">
       <div className="flex items-center gap-3 shrink-0">
         <div className="bg-indigo-600 text-white p-2 rounded-lg font-black text-sm">{PROJECT_NAME}</div>
         <div className="flex flex-col">
           <h1 className="text-xl font-bold text-slate-800 leading-none">{VERSION}</h1>
           <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
             {initialSettlements.length} יישובים • גרסת Right Sidebar
           </span>
         </div>
       </div>


       <div className="flex-1 max-w-md relative">
         <form onSubmit={handleSearchSubmit} className="relative">
           <input
             type="text"
             placeholder="חפש יישוב או אדם..."
             className={`w-full bg-slate-100 border-2 rounded-full py-2 px-10 text-sm transition-all outline-none text-right ${searchError ? 'border-red-500 shake' : 'border-transparent focus:ring-2 focus:ring-indigo-500 bg-white shadow-inner'}`}
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
           <span className="absolute left-4 top-2.5 text-slate-400">🔍</span>
          
           {suggestions.length > 0 && (
             <div className="absolute top-full right-0 left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50">
               {suggestions.map((item, idx) => (
                 <div
                   key={idx}
                   className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-none"
                   onClick={() => {
                     setSearchQuery(item.name);
                     setSuggestions([]);
                     if (item.type === 'settlement') {
                       handleSettlementSelection(item);
                       setSearchQuery('');
                     } else {
                       handleSearchSubmit(null, item);
                     }
                   }}
                 >
                   <span className="text-sm font-medium text-slate-700">{item.name}</span>
                   <span className="text-xs text-slate-400">{item.type === 'settlement' ? '📍 יישוב' : '👤 אדם'}</span>
                 </div>
               ))}
             </div>
           )}
          
           {searchError && (
             <div className={`absolute top-full right-4 mt-2 px-3 py-1.5 border font-bold rounded-lg shadow-sm animate-pulse z-50 whitespace-nowrap text-xs ${
               searchError.includes('קיים במאגר')
               ? 'bg-orange-50 border-orange-200 text-orange-600'
               : 'bg-red-50 border-red-200 text-red-600'
             }`}>
               {searchError}
             </div>
           )}
         </form>
       </div>
     </header>


     <div className="flex-1 relative flex">
       <div ref={mapRef} className="flex-1 z-0" />


       <aside className={`absolute right-0 top-0 bottom-0 w-80 md:w-96 bg-white shadow-2xl z-20 transition-all duration-500 border-l border-slate-200 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
         <div className="h-full flex flex-col">
           <div className="p-5 border-b border-slate-100 flex flex-col justify-center bg-indigo-700 text-white shadow-lg shrink-0 relative">
             <div className="flex justify-between items-start mb-2">
               <h2 className="text-xl font-bold leading-tight truncate pl-8">{selectedSettlement?.name}</h2>
               <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 left-4 hover:bg-white/20 p-2 rounded-full leading-none transition-all">✕</button>
             </div>
             <div className="text-[11px] opacity-90 leading-relaxed bg-white/10 p-2 rounded-lg border border-white/10 italic">
               {settlementSummary || 'טוען נתונים...'}
             </div>
           </div>


           <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-100">
             {isLoading ? (
               <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
                 <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                 <p className="text-sm font-bold animate-pulse">טוען אישים...</p>
               </div>
             ) : people.length > 0 ? (
               <div className="space-y-3">
                 {people.map((p) => {
                   const isHighlighted = p.id === highlightedPersonId;
                   return (
                     <div
                       key={p.id}
                       ref={el => personRefs.current[p.id] = el}
                       className={`p-3 rounded-2xl transition-all cursor-pointer group flex items-center gap-4 border relative ${isHighlighted ? 'bg-indigo-50 border-indigo-400 ring-4 ring-indigo-100 spotlight-pulse' : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md'}`}
                       onClick={() => p.wiki_url && window.open(p.wiki_url, '_blank')}
                     >
                       {p.birthYear && (
                         <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md shadow-sm z-10 bg-indigo-600 text-white text-[10px] font-bold border border-white/20 pointer-events-none">
                           שנת לידה: {p.birthYear}
                         </div>
                       )}


                       <div className="relative shrink-0">
                         {p.image ? (
                           <img src={`${p.image}?width=150`} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" alt={p.full_name} />
                         ) : (
                           <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl bg-slate-200 text-slate-400">{p.full_name?.[0]}</div>
                         )}
                         <div className="absolute -bottom-1 -right-1 bg-amber-400 text-white text-[9px] px-1.5 py-0.5 rounded-lg border-2 border-white font-black shadow-sm">
                           {p.popularity || 0}
                         </div>
                       </div>


                       <div className="min-w-0 flex-1 pl-2">
                         <h3 className={`font-bold text-sm leading-tight transition-colors ${isHighlighted ? 'text-indigo-900 text-base' : 'text-slate-800'}`}>
                           {p.full_name}
                         </h3>
                         {p.description && (
                           <p className={`text-[11px] line-clamp-2 mt-1 leading-snug ${isHighlighted ? 'text-indigo-600' : 'text-slate-500'}`}>
                             {p.description}
                           </p>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
             ) : (
               <div className="flex flex-col items-center justify-center h-full py-20 text-center opacity-60">
                 <div className="bg-slate-200 p-6 rounded-full mb-4">
                   <span className="text-4xl">📭</span>
                 </div>
                 <h3 className="text-lg font-bold text-slate-700 mb-2">אין תוצאות במאגר</h3>
                 <p className="text-sm text-slate-500 max-w-[200px]">
                   לא נמצאו אישים המשויכים ליישוב זה בבסיס הנתונים שלנו.
                 </p>
               </div>
             )}
           </div>
         </div>
       </aside>
     </div>


     <style>{`
       .custom-tooltip { background: #1e293b; color: white; border-radius: 4px; padding: 2px 8px; font-weight: bold; border: none; }
       @keyframes spotlightPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
       .spotlight-pulse { animation: spotlightPulse 1.5s infinite ease-in-out; }
       .custom-scrollbar { scrollbar-width: thin; }
       .custom-scrollbar::-webkit-scrollbar { width: 4px; }
       .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
       .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
       @keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 0, 0); } 40%, 60% { transform: translate3d(4px, 0, 0); } }


       .ripple-wrapper {
         display: flex;
         justify-content: center;
         align-items: center;
       }
       .ripple-effect {
         width: 14px;
         height: 14px;
         background-color: rgba(79, 70, 229, 0.4);
         border: 2px solid #4f46e5;
         border-radius: 50%;
         animation: ripple 2s infinite ease-out;
         pointer-events: none;
       }
       @keyframes ripple {
         0% {
           transform: scale(1);
           opacity: 0.8;
         }
         100% {
           transform: scale(4);
           opacity: 0;
         }
       }
     `}</style>
   </div>
 );
};


export default App;
