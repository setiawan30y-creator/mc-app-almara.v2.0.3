<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if ($data) {
        $logLine = "[" . date('Y-m-d H:i:s') . "] " . json_encode($data) . "\n";
        file_put_contents(__DIR__ . '/browser_errors.log', $logLine, FILE_APPEND);
    }
}
echo json_encode(['status' => 'ok']);
