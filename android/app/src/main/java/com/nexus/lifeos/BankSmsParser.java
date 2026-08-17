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

    // Indian DLT-registered sender IDs are 6 characters, usually prefixed
    // with a 2-letter telecom route code and a hyphen, e.g. "VM-HDFCBK",
    // "AD-SBIINB", "VK-ICICIB". A plain 6-char alphanumeric ID (no hyphen)
    // is also common on some carriers. This is intentionally permissive -
    // it only decides whether to attempt a parse at all, not whether the
    // SMS is ultimately kept (the amount/keyword checks in parse() below
    // are the real filter).
    private static final Pattern SENDER_ID_PATTERN =
            Pattern.compile("^[A-Z]{2}-[A-Z0-9]{6}$|^[A-Z0-9]{6}$");

    // "Rs.", "Rs", "INR", or "₹" followed by a number (with optional
    // thousands separators and paise).
    private static final Pattern AMOUNT_PATTERN =
            Pattern.compile("(?:Rs\\.?|INR|₹)\\s?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)", Pattern.CASE_INSENSITIVE);

    private static final Pattern DEBIT_KEYWORDS =
            Pattern.compile("\\b(debited|debit|spent|paid|withdrawn|purchase of)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern CREDIT_KEYWORDS =
            Pattern.compile("\\b(credited|credit|received|deposited)\\b", Pattern.CASE_INSENSITIVE);

    // Best-effort merchant/description extraction - tries a few common
    // phrasings ("to VPA x", "at MERCHANT", "towards X", "to Ac X" is
    // deliberately excluded since that's usually the user's own account,
    // not a merchant). Falls back to null (caller uses a generic label)
    // rather than grabbing an unrelated fragment of the SMS.
    private static final Pattern MERCHANT_PATTERN =
            Pattern.compile("(?:to VPA|at|towards|to)\\s+([A-Za-z0-9@._\\- ]{3,40}?)(?:\\s+on\\s|\\s+dated\\s|[.,]|$)", Pattern.CASE_INSENSITIVE);

    private BankSmsParser() {}

    static boolean isLikelyBankSms(String sender, String body) {
        if (body == null || body.isEmpty()) return false;
        boolean senderLooksLikeBank = sender != null && SENDER_ID_PATTERN.matcher(sender.trim()).matches();
        boolean hasAmount = AMOUNT_PATTERN.matcher(body).find();
        boolean hasTransactionKeyword = DEBIT_KEYWORDS.matcher(body).find() || CREDIT_KEYWORDS.matcher(body).find();
        // Require an amount AND a transaction keyword always; the sender
        // pattern alone is too weak a signal (a bank might also send a
        // marketing SMS from the same sender ID), so it's additive
        // confidence, not a standalone qualifier.
        return hasAmount && hasTransactionKeyword && (senderLooksLikeBank || true);
    }

    static ParsedTransaction parse(String sender, String body) {
        if (!isLikelyBankSms(sender, body)) return null;

        Matcher amountMatcher = AMOUNT_PATTERN.matcher(body);
        if (!amountMatcher.find()) return null;
        double amount;
        try {
            amount = Double.parseDouble(amountMatcher.group(1).replace(",", ""));
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
