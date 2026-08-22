package com.nexus.lifeos;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Best-effort parser for Indian bank transaction SMS.
 *
 * This is heuristic, not exhaustive: bank SMS formats vary widely across
 * institutions and even change over time for the same bank. The patterns
 * below cover the common shapes seen from major Indian banks (SBI, HDFC,
 * ICICI, Axis, Kotak, etc.) - a genuinely unparseable SMS is dropped
 * (parse() returns null) rather than guessed at, so a bad match never
 * silently corrupts the user's real transaction history.
 */
final class BankSmsParser {

    static final class ParsedTransaction {
        final String type; // "Income" or "Expense" - matches Nexus's own transaction shape
        final double amount;
        final String description;

        ParsedTransaction(String type, double amount, String description) {
            this.type = type;
            this.amount = amount;
            this.description = description;
        }
    }

    // The amount immediately adjacent to the actual debit/credit/sent
    // keyword - either "[Rs.]500.00 debited" (currency optional: many real
    // UPI alerts, e.g. SBI's "A/C X1234 Debited by 500.0 on...", state the
    // amount with no currency symbol at all) or "debited [by/with] [Rs.]500".
    // Deliberately NOT a whole-message "find any Rs.-prefixed number
    // anywhere" search: a real bank SMS almost always also states the
    // post-transaction balance elsewhere in the same message (e.g. "...Avl
    // Bal Rs 5,000.00"), also currency-prefixed - an earlier version of
    // this pattern searched the whole message first and would happily grab
    // that BALANCE as if it were the transaction amount whenever the real
    // amount itself lacked a currency symbol. Anchoring the search to right
    // next to the keyword is what actually fixes that, not just adding a
    // second pattern.
    // Every real transaction verb this parser recognizes (see DEBIT_KEYWORDS/
    // CREDIT_KEYWORDS below) - kept as one shared list so the amount search
    // can never silently miss an amount just because it sat next to a verb
    // this parser otherwise already knows means a real transaction ("spent",
    // "paid", "withdrawn", "received", "deposited", "purchase" - not just
    // "debited"/"credited"/"sent"). "purchase" (not the 2-word "purchase
    // of") is enough here since the optional (by|with|for|of) group already
    // below absorbs the "of" - this file's classification keywords stay the
    // safer 2-word "purchase of" (see DEBIT_KEYWORDS), this is purely a
    // "where's the number" search, not itself a classification decision.
    private static final String TXN_VERBS = "debited|credited|spent|paid|withdrawn|received|deposited|sent|purchase";
    // Two distinct shapes, deliberately NOT symmetric on whether a currency
    // symbol is required:
    // - "[Rs.]500.00 debited" (amount BEFORE the verb) REQUIRES a currency
    //   symbol. Account numbers routinely sit directly in front of the verb
    //   in real bank SMS ("A/C XXXXXXX1234 Debited by 500.0 on...") with
    //   nothing but a space between the digits and the verb - an earlier,
    //   looser version of this alternative (currency optional here too)
    //   happily matched "1234" out of that account number as if it were the
    //   transaction amount. Requiring the currency symbol in this direction
    //   is what rules that out, since a real account number is never
    //   preceded by "Rs."/"INR"/"₹".
    // - "debited by [Rs.]500.00" (verb BEFORE the amount) keeps the
    //   currency symbol optional, since this is the shape real currency-less
    //   UPI alerts actually use (e.g. SBI's "Debited by 500.0") - the verb
    //   itself is already the anchor here, so there's no equivalent
    //   account-number collision risk.
    private static final Pattern AMOUNT_NEAR_KEYWORD_PATTERN = Pattern.compile(
            "(?:Rs\\.?|INR|₹)\\s?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s+(?:has\\s+been\\s+|is\\s+|was\\s+)?(?:" + TXN_VERBS + ")\\b"
            + "|\\b(?:" + TXN_VERBS + ")\\b\\s*(?:by|with|for|of)?\\s*(?:Rs\\.?|INR|₹)?\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)",
            Pattern.CASE_INSENSITIVE);

    // Deliberately "debited" (the conjugated verb), never the bare noun
    // "debit" - the actual root cause behind a huge, common class of real
    // transactions being silently dropped as "ambiguous" (see isDebit ==
    // isCredit below): the overwhelming majority of bank SMS - including
    // CREDIT/refund messages - mention "Debit Card ending XXXX" as pure
    // boilerplate identifying which card was used, regardless of which
    // direction the money actually moved. A bare \bdebit\b matched that
    // boilerplate every time, making a huge fraction of genuine credits
    // look "ambiguous" and get dropped entirely.
    private static final Pattern DEBIT_KEYWORDS =
            Pattern.compile("\\b(debited|spent|paid|withdrawn|purchase of|sent)\\b", Pattern.CASE_INSENSITIVE);
    // Same reasoning in reverse: "credited" (the verb), never bare "credit"
    // - "Credit Card ending XXXX" boilerplate appears in plenty of real
    // DEBIT (purchase/spend) SMS too, and a bare \bcredit\b there caused
    // the exact same false-ambiguous drop for a very common real case
    // (any credit-card transaction alert).
    private static final Pattern CREDIT_KEYWORDS =
            Pattern.compile("\\b(credited|received|deposited)\\b", Pattern.CASE_INSENSITIVE);

    // Returns null if no amount sits next to a real transaction keyword.
    private static String extractAmountString(String body) {
        Matcher m = AMOUNT_NEAR_KEYWORD_PATTERN.matcher(body);
        if (!m.find()) return null;
        return m.group(1) != null ? m.group(1) : m.group(2);
    }

    // Best-effort merchant/description extraction - tries a few common
    // phrasings ("to VPA x", "at MERCHANT", "towards X", "from SENDER" for
    // the credit side; "to Ac X" is deliberately excluded since that's
    // usually the user's own account, not a merchant). Falls back to null
    // (caller uses a generic label) rather than grabbing an unrelated
    // fragment of the SMS. Stops at the first of several common trailing
    // boilerplate markers (Ref/Avl Bal/UPI/Info/Txn), not just punctuation -
    // without these, a message like "...transfer to Mr John Doe Ref No
    // 123456789012 Avl Bal Rs 4,500.00" (a real, common SBI phrasing with
    // no comma/period before "Ref") would capture up to 40 characters of
    // reference-number noise instead of cleanly stopping at the real name.
    private static final Pattern MERCHANT_PATTERN =
            Pattern.compile(
                "(?:to VPA|towards|from|at|to)\\s+([A-Za-z0-9@._\\- ]{3,40}?)"
                + "(?:\\s+on\\b|\\s+dated\\b|\\s+ref\\b|\\s+refno\\b|\\s+avl\\b|\\s+upi\\b|\\s+info\\b|\\s+txn\\b|[.,]|$)",
                Pattern.CASE_INSENSITIVE);

    private BankSmsParser() {}

    static boolean isLikelyBankSms(String sender, String body) {
        if (body == null || body.isEmpty()) return false;
        boolean hasAmount = extractAmountString(body) != null;
        boolean hasTransactionKeyword = DEBIT_KEYWORDS.matcher(body).find() || CREDIT_KEYWORDS.matcher(body).find();
        // Require an amount AND a transaction keyword always. The sender
        // ID pattern above is intentionally not gated on here - a real
        // bank SMS's sender ID scheme varies too much across telecom
        // routes/carriers to safely use as a hard filter; amount +
        // keyword is the real, reliable signal.
        return hasAmount && hasTransactionKeyword;
    }

    static ParsedTransaction parse(String sender, String body) {
        if (!isLikelyBankSms(sender, body)) return null;

        String amountStr = extractAmountString(body);
        if (amountStr == null) return null;
        double amount;
        try {
            amount = Double.parseDouble(amountStr.replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
        if (amount <= 0) return null;

        boolean isDebit = DEBIT_KEYWORDS.matcher(body).find();
        boolean isCredit = CREDIT_KEYWORDS.matcher(body).find();
        // If both or neither keyword group matched, this SMS is too
        // ambiguous to auto-classify - skip it rather than guess the
        // direction of money movement, which would silently corrupt the
        // user's real balance math.
        if (isDebit == isCredit) return null;
        String type = isDebit ? "Expense" : "Income";

        String description = null;
        Matcher merchantMatcher = MERCHANT_PATTERN.matcher(body);
        if (merchantMatcher.find()) {
            description = merchantMatcher.group(1).trim();
        }
        if (description == null || description.isEmpty()) {
            description = (sender != null && !sender.isEmpty()) ? ("Bank SMS - " + sender) : "Bank SMS Transaction";
        }

        return new ParsedTransaction(type, amount, description);
    }
}
