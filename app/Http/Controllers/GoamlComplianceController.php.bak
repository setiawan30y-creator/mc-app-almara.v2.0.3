<?php

namespace App\Http\Controllers;

use App\Models\GoamlAlert;
use App\Models\GoamlRule;
use App\Models\Transaction;
use App\Services\GoamlComplianceService;
use Illuminate\Http\Request;

class GoamlComplianceController extends Controller
{
    public function rules()
    {
        return response()->json(
            GoamlRule::orderBy('priority')->orderBy('id')->get()
        );
    }

    public function storeRule(Request $request)
    {
        $data = $request->validate([
            'name' => ['required','string','max:180'],
            'code' => ['required','string','max:80'],
            'rule_type' => ['required','string','max:40'],
            'regulation_source' => ['nullable','string','max:80'],
            'regulation_no' => ['nullable','string','max:120'],
            'regulation_article' => ['nullable','string','max:120'],
            'effective_from' => ['nullable','date'],
            'effective_until' => ['nullable','date','after_or_equal:effective_from'],
            'target' => ['required','string','max:40'],
            'classification' => ['nullable','string','max:20'],
            'severity' => ['required','string','max:20'],
            'action' => ['required','string','max:30'],
            'result_type' => ['required','string','max:40'],
            'min_transactions' => ['nullable','integer','min:1'],
            'period_days' => ['nullable','integer','min:1'],
            'total_amount_idr' => ['nullable','numeric','min:0'],
            'amount_operator' => ['nullable','in:>,>=,=,<,<='],
            'payment_method' => ['nullable','string','max:50'],
            'conditions' => ['nullable','array'],
            'internal_note' => ['nullable','string','max:5000'],
            'is_active' => ['nullable','boolean'],
            'priority' => ['nullable','integer','min:1'],
        ]);

        $data['code'] = strtoupper($data['code']);
        $data['version'] = 1;
        $data['is_active'] = $data['is_active'] ?? true;
        $data['priority'] = $data['priority'] ?? 100;

        return response()->json([
            'status' => 'success',
            'rule' => GoamlRule::create($data),
        ], 201);
    }

    public function updateRule(Request $request, GoamlRule $rule)
    {
        $data = $request->validate([
            'name' => ['sometimes','string','max:180'],
            'code' => ['sometimes','string','max:80'],
            'rule_type' => ['sometimes','string','max:40'],
            'regulation_source' => ['nullable','string','max:80'],
            'regulation_no' => ['nullable','string','max:120'],
            'regulation_article' => ['nullable','string','max:120'],
            'effective_from' => ['nullable','date'],
            'effective_until' => ['nullable','date','after_or_equal:effective_from'],
            'target' => ['sometimes','string','max:40'],
            'classification' => ['nullable','string','max:20'],
            'severity' => ['sometimes','string','max:20'],
            'action' => ['sometimes','string','max:30'],
            'result_type' => ['sometimes','string','max:40'],
            'min_transactions' => ['nullable','integer','min:1'],
            'period_days' => ['nullable','integer','min:1'],
            'total_amount_idr' => ['nullable','numeric','min:0'],
            'amount_operator' => ['nullable','in:>,>=,=,<,<='],
            'payment_method' => ['nullable','string','max:50'],
            'conditions' => ['nullable','array'],
            'internal_note' => ['nullable','string','max:5000'],
            'is_active' => ['nullable','boolean'],
            'priority' => ['nullable','integer','min:1'],
        ]);

        if (isset($data['code'])) {
            $data['code'] = strtoupper($data['code']);
        }

        $data['version'] = $rule->version + 1;
        $rule->update($data);

        return response()->json(['status' => 'success', 'rule' => $rule->fresh()]);
    }

    public function alerts(Request $request)
    {
        $query = GoamlAlert::with(['rule', 'transactions.transaction'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json($query->limit(200)->get());
    }

    public function evaluate(Request $request, GoamlComplianceService $service)
    {
        $request->validate([
            'itemId' => ['required','string','max:100'],
        ]);

        $transaction = Transaction::where('itemId', $request->string('itemId'))->firstOrFail();
        $alerts = $service->evaluateTransaction($transaction);

        return response()->json([
            'status' => 'success',
            'transaction' => $transaction,
            'alerts' => $alerts,
        ]);
    }

    public function review(Request $request, GoamlAlert $alert)
    {
        $data = $request->validate([
            'status' => ['required','in:IN_REVIEW,APPROVED,REJECTED,ESCALATED'],
            'review_note' => ['nullable','string','max:5000'],
        ]);

        $alert->update([
            'status' => $data['status'],
            'review_note' => $data['review_note'] ?? null,
            'reviewed_by' => $request->user()?->name
                ?? $request->user()?->username
                ?? ($request->attributes->get('dev_user')['username'] ?? 'SYSTEM'),
            'reviewed_at' => now(),
        ]);

        return response()->json(['status' => 'success', 'alert' => $alert->fresh()]);
    }
}
