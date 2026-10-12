<?php
namespace App\Http\Controllers;
use App\Models\Datastore; use App\Models\LetterNumberCounter; use App\Models\LetterRecord; use App\Models\LetterDocument;
use Illuminate\Http\Request; use Illuminate\Support\Facades\DB; use Illuminate\Validation\Rule; use Symfony\Component\Process\Process;
class LetterNumberController extends Controller {
 private const STORE_KEY='mc_letter_number_settings';
 public function settings(){return response()->json(['status'=>'success','data'=>$this->settingsArray()]);}
 public function saveSettings(Request $request){$v=$request->validate(['company_code'=>['required','string','max:20'],'format'=>['required','string','max:200'],'digits'=>['required','integer','min:1','max:10'],'month_format'=>[Rule::in(['short','numeric','long'])],'reset_mode'=>[Rule::in(['yearly','never'])],'letter_types'=>['required','array','min:1'],'letter_types.*.code'=>['required','string','max:20'],'letter_types.*.name'=>['required','string','max:100']]);$v['company_code']=strtoupper(trim($v['company_code']));$v['letter_types']=collect($v['letter_types'])->map(fn($r)=>['code'=>strtoupper(trim($r['code'])),'name'=>trim($r['name'])])->unique('code')->values()->all();Datastore::updateOrCreate(['store_key'=>self::STORE_KEY],['json_data'=>$v]);return response()->json(['status'=>'success','data'=>$v]);}
 public function index(){return response()->json(['status'=>'success','data'=>LetterRecord::with('documents')->latest('id')->limit(200)->get()]);}
 public function next(Request $request){$v=$request->validate(['letter_type'=>['required','string','max:20'],'date'=>['nullable','date'],'subject'=>['nullable','string','max:255']]);$s=$this->settingsArray();$company=strtoupper(trim($s['company_code']));$type=strtoupper(trim($v['letter_type']));$date=isset($v['date'])?\Carbon\Carbon::parse($v['date']):now();$year=(int)$date->year;$allowed=collect($s['letter_types'])->pluck('code')->map(fn($x)=>strtoupper($x));if(!$allowed->contains($type))return response()->json(['status'=>'error','message'=>'Jenis surat belum terdaftar.'],422);$result=DB::transaction(function()use($company,$type,$year,$date,$v,$s){$c=LetterNumberCounter::query()->where('company_code',$company)->where('letter_type',$type)->where('year',$year)->lockForUpdate()->first();if(!$c)$c=LetterNumberCounter::create(['company_code'=>$company,'letter_type'=>$type,'year'=>$year,'last_number'=>0]);$c->last_number=(int)$c->last_number+1;$c->save();$number=$this->formatNumber($c->last_number,$company,$type,$date,$s);$record=LetterRecord::create(['letter_number'=>$number,'sequence'=>$c->last_number,'company_code'=>$company,'letter_type'=>$type,'letter_date'=>$date->toDateString(),'subject'=>$v['subject']??null,'status'=>'MENUNGGU DOKUMEN']);return [$number,$c->last_number,$record->id];});return response()->json(['status'=>'success','data'=>['number'=>$result[0],'sequence'=>$result[1],'record_id'=>$result[2],'company_code'=>$company,'letter_type'=>$type,'year'=>$year]]);}
 public function documents($id){$r=LetterRecord::with('documents')->findOrFail($id);return response()->json(['status'=>'success','data'=>$r]);}
 public function previewDocument($documentId){
  $doc=LetterDocument::with('letter')->findOrFail($documentId);
  $path=public_path(ltrim(parse_url($doc->file_url,PHP_URL_PATH) ?: '', '/'));
  if(!is_file($path)) abort(404,'File surat tidak ditemukan.');

  $mime=strtolower((string)($doc->mime_type ?: 'application/octet-stream'));
  $officeMimes=[
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  // Browser-native preview: PDF dan gambar ditampilkan langsung.
  if(!in_array($mime,$officeMimes,true)){
      $inlineName=basename($doc->file_name);
      return response()->file($path,[
          'Content-Type'=>$mime,
          'Content-Disposition'=>'inline; filename="'.addslashes($inlineName).'"'
      ]);
  }

  // Word/Excel tidak punya renderer native yang konsisten di browser.
  // Konversi sekali ke PDF memakai LibreOffice/soffice, lalu tampilkan PDF inline.
  $previewDir=storage_path('app/letter-previews');
  if(!is_dir($previewDir)) mkdir($previewDir,0755,true);
  $previewPath=$previewDir.'/letter-'.$doc->id.'.pdf';

  if(!is_file($previewPath) || filemtime($previewPath)<filemtime($path)){
      $soffice=$this->findOfficeBinary();
      if(!$soffice){
          return response()->json([
              'status'=>'error',
              'message'=>'Preview Word/Excel membutuhkan LibreOffice (soffice). File asli tetap dapat di-download.'
          ],503);
      }

      $sourceDir=dirname($path);
      $process=new Process([
          $soffice,
          '--headless',
          '--convert-to','pdf',
          '--outdir',$previewDir,
          $path
      ]);
      $process->setTimeout(120);
      $process->run();

      $generated=$previewDir.'/'.pathinfo($path,PATHINFO_FILENAME).'.pdf';
      if(!$process->isSuccessful() || !is_file($generated)){
          return response()->json([
              'status'=>'error',
              'message'=>'File tidak dapat dikonversi menjadi PDF untuk preview.',
              'detail'=>trim($process->getErrorOutput() ?: $process->getOutput())
          ],422);
      }

      if($generated!==$previewPath){
          @rename($generated,$previewPath);
      }
  }

  return response()->file($previewPath,[
      'Content-Type'=>'application/pdf',
      'Content-Disposition'=>'inline; filename="'.addslashes(pathinfo($doc->file_name,PATHINFO_FILENAME).'.pdf').'"'
  ]);
 }

 private function findOfficeBinary(): ?string {
  $candidates=[
      env('LIBREOFFICE_PATH'),
      'soffice',
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      '/usr/bin/soffice',
      '/usr/local/bin/soffice',
  ];
  foreach($candidates as $candidate){
      if(!$candidate) continue;
      if($candidate==='soffice') return $candidate;
      if(is_file($candidate) && is_executable($candidate)) return $candidate;
  }
  return null;
 }
 public function downloadDocument($documentId){
  $doc=LetterDocument::with('letter')->findOrFail($documentId);
  $path=public_path(ltrim(parse_url($doc->file_url,PHP_URL_PATH) ?: '', '/'));
  if(!is_file($path)) abort(404,'File surat tidak ditemukan.');
  return response()->download($path,$doc->file_name,['Content-Type'=>$doc->mime_type ?: 'application/octet-stream']);
 }
 public function uploadDocument(Request $request,$id){$r=LetterRecord::findOrFail($id);$v=$request->validate(['data_url'=>['required','string'],'filename'=>['required','string','max:255'],'description'=>['nullable','string','max:255']]);if(!preg_match('/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i',$v['data_url'],$m))return response()->json(['status'=>'error','message'=>'Format file tidak valid.'],422);$bin=base64_decode($m[2],true);if($bin===false||strlen($bin)>10*1024*1024)return response()->json(['status'=>'error','message'=>'File tidak valid atau melebihi 10 MB.'],422);$exts=['application/pdf'=>'pdf','image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','application/msword'=>'doc','application/vnd.openxmlformats-officedocument.wordprocessingml.document'=>'docx','application/vnd.ms-excel'=>'xls','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'=>'xlsx'];$mime=strtolower($m[1]);if(!isset($exts[$mime]))return response()->json(['status'=>'error','message'=>'Tipe file tidak didukung.'],422);$safe=\Illuminate\Support\Str::slug(pathinfo($v['filename'],PATHINFO_FILENAME))?:'surat';$name=$safe.'-'.now()->format('YmdHis').'-'.\Illuminate\Support\Str::random(5).'.'.$exts[$mime];$dir=public_path('uploads/company/documents');if(!is_dir($dir))mkdir($dir,0755,true);file_put_contents($dir.DIRECTORY_SEPARATOR.$name,$bin);$doc=LetterDocument::create(['letter_record_id'=>$r->id,'file_name'=>$v['filename'],'file_url'=>'/uploads/company/documents/'.$name,'mime_type'=>$mime,'file_size'=>strlen($bin),'description'=>$v['description']??null]);$r->update(['status'=>'DOKUMEN TERUPLOAD']);return response()->json(['status'=>'success','message'=>'Dokumen berhasil diupload.','data'=>$doc]);}
 private function settingsArray():array{$store=Datastore::where('store_key',self::STORE_KEY)->first();$s=$store?->json_data;if(is_string($s))$s=json_decode($s,true);$s=is_array($s)?$s:[];return $s+['company_code'=>'APV','format'=>'{NO}/{COMPANY}/{TYPE}/{MONTH}/{YEAR}','digits'=>4,'month_format'=>'short','reset_mode'=>'yearly','letter_types'=>[['code'=>'SK','name'=>'Surat Keputusan'],['code'=>'SPK','name'=>'Surat Perjanjian Kerja'],['code'=>'PKS','name'=>'Perjanjian Kerja Sama'],['code'=>'SP','name'=>'Surat Pernyataan'],['code'=>'SKK','name'=>'Surat Keterangan'],['code'=>'ST','name'=>'Surat Tugas'],['code'=>'SPT','name'=>'Surat Perintah Tugas'],['code'=>'BA','name'=>'Berita Acara'],['code'=>'MEMO','name'=>'Memorandum Internal'],['code'=>'UND','name'=>'Surat Undangan'],['code'=>'INV','name'=>'Invoice'],['code'=>'KW','name'=>'Kwitansi'],['code'=>'SR','name'=>'Surat Referensi'],['code'=>'LAIN','name'=>'Dokumen Lainnya']]];}
 private function formatNumber(int $seq,string $company,string $type,$date,array $s):string{$no=str_pad((string)$seq,max(1,(int)$s['digits']),'0',STR_PAD_LEFT);$months=['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];$month=match($s['month_format']){'numeric'=>str_pad((string)$date->month,2,'0',STR_PAD_LEFT),'long'=>['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'][$date->month-1],default=>$months[$date->month-1]};return strtr((string)$s['format'],['{NO}'=>$no,'{COMPANY}'=>$company,'{TYPE}'=>$type,'{MONTH}'=>$month,'{YEAR}'=>$date->year]);}
}
