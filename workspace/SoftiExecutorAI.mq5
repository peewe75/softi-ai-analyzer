#property strict
#property version "2.950"
#include <Trade/Trade.mqh>

enum MODE { SIGNAL=0, TRADING=1 };
enum CONFIDENCE_MODE { REAL=0, ALGO=1 };

input MODE InpMode=SIGNAL;
input CONFIDENCE_MODE InpConfidenceMode=ALGO;
input bool InpShowLiveReport=true;
input bool InpEnableTimer=true;
input int InpTimerSeconds=5;
input bool InpPrintLogs=true;
input bool InpEnableJsonControl=true;
input bool InpReverseMode=true;
input bool InpReadBullPng=true;
input double InpMinConfidence=0.70;
input int InpReportTradesMin=1000;
input bool InpScanAllOpenCharts=true;
input int InpMaxSymbolsInLine=6;

// additive analyzer inputs
input bool InpUseWyckoffEngine=false;
input bool InpShowAnalyzerFields=true;
input bool InpAllowCryptoSymbols=true;
input bool InpAllowDemoAccounts=true;
input bool InpIgnoreSpreadInAnalysis=true;
input bool InpUseSessionQuality=true;
input bool InpUseRRWeighting=true;
input bool InpApplySellableTheme=true;

string UI_BG="SOFTI_EXEC_UI_BG";
string UI_HEADER="SOFTI_EXEC_UI_HEADER";
string UI_LABEL="SOFTI_EXEC_UI_LABEL";
string UI_BTN="SOFTI_EXEC_UI_BTN";
int g_mode_runtime=0;
datetime g_last_update=0;

void ApplySellableTheme(){
   if(!InpApplySellableTheme) return;
   long cid = ChartID();
   ChartSetInteger(cid, CHART_COLOR_BACKGROUND, clrBlack);
   ChartSetInteger(cid, CHART_COLOR_FOREGROUND, clrWhite);
   ChartSetInteger(cid, CHART_COLOR_GRID, C'10,10,10');
   ChartSetInteger(cid, CHART_SHOW_GRID, true);
   ChartSetInteger(cid, CHART_SHOW_VOLUMES, false);
   ChartSetInteger(cid, CHART_COLOR_CANDLE_BULL, clrLime);
   ChartSetInteger(cid, CHART_COLOR_CANDLE_BEAR, clrRed);
   ChartSetInteger(cid, CHART_COLOR_CHART_UP, clrLime);
   ChartSetInteger(cid, CHART_COLOR_CHART_DOWN, clrRed);
   ChartSetInteger(cid, CHART_MODE, CHART_CANDLES);
   ChartRedraw();
}



void LogPrint(const string msg){if(InpPrintLogs) Print("SOFTI EXEC | ",msg);}
string SanitizeSymbol(const string s){string x=s; StringReplace(x,".",""); StringReplace(x,"_",""); return x;}
bool ReadTextFile(const string relpath,string &out){
   out="";
   int h=FileOpen(relpath,FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE);
   if(h==INVALID_HANDLE) return false;
   while(!FileIsEnding(h)) out += FileReadString(h)+"\n";
   FileClose(h);
   return (StringLen(out)>0);
}
string JsonGetString(const string json,const string key){
   string pat="\"" + key + "\"";
   int p=StringFind(json,pat); if(p<0) return "";
   p=StringFind(json,":",p); if(p<0) return "";
   int q=StringFind(json,"\"",p); if(q<0) return "";
   int r=StringFind(json,"\"",q+1); if(r<0) return "";
   return StringSubstr(json,q+1,r-q-1);
}
double JsonGetNumber(const string json,const string key){
   string pat="\"" + key + "\"";
   int p=StringFind(json,pat); if(p<0) return -1.0;
   p=StringFind(json,":",p); if(p<0) return -1.0;
   int s=p+1; while(s<StringLen(json) && (StringGetCharacter(json,s)==' ' || StringGetCharacter(json,s)=='\t')) s++;
   int e=s; while(e<StringLen(json)){int c=StringGetCharacter(json,e); if((c>='0'&&c<='9')||c=='.'||c=='-') e++; else break;}
   return StringToDouble(StringSubstr(json,s,e-s));
}
bool JsonGetBool(const string json,const string key,bool &val){
   string pat="\"" + key + "\"";
   int p=StringFind(json,pat); if(p<0) return false;
   p=StringFind(json,":",p); if(p<0) return false;
   int s=p+1; while(s<StringLen(json) && StringGetCharacter(json,s)==' ') s++;
   string rest=StringSubstr(json,s,5);
   if(StringFind(rest,"true")==0){val=true; return true;}
   if(StringFind(rest,"false")==0){val=false; return true;}
   return false;
}
string JsonPathForSymbol(const string sym){return "BULL_AI\\last_signal_"+SanitizeSymbol(sym)+".json";}
string AnalyzerPathForSymbol(const string sym){return "BULL_AI\\analyzer_"+SanitizeSymbol(sym)+".json";}
bool AlreadySeenExec(string &arr[], int used, const string sym){for(int i=0;i<used;i++) if(arr[i]==sym) return true; return false;}

string ShortWyckoff(const string phase,const string event_name,const double conf){
   if(!InpUseWyckoffEngine) return "";
   string p=phase;
   if(phase=="ACCUMULATION") p="ACC";
   else if(phase=="DISTRIBUTION") p="DST";
   else if(phase=="MARKUP") p="MUP";
   else if(phase=="MARKDOWN") p="MDN";
   else if(phase=="NEUTRAL") p="NEU";
   if(event_name!="" && event_name!="NONE") p += ":" + event_name;
   if(conf>=0) p += " " + DoubleToString(conf,0);
   return p;
}

string BuildCompactScanLine(){
   string line="";
   int shown=0;
   string seen[];
   ArrayResize(seen,50);
   int used=0;
   long cid=ChartFirst();
   int guard=0;
   while(cid>=0 && guard<50){
      string sym=ChartSymbol(cid);
      if(sym!="" && !AlreadySeenExec(seen,used,sym)){
         seen[used]=sym; used++;
         string raw="", araw="";
         if(ReadTextFile(JsonPathForSymbol(sym),raw)){
            string action=JsonGetString(raw,"action");
            if(action=="") action="--";
            double conf=JsonGetNumber(raw,"confidence_score");
            string a="W";
            if(action=="buy") a="B";
            else if(action=="sell") a="S";
            else if(action=="wait") a="W";
            string info=sym+" "+a+" "+DoubleToString(conf,2);

            if(ReadTextFile(AnalyzerPathForSymbol(sym),araw)){
               int bs=(int)JsonGetNumber(araw,"bias_strength");
               string rg=JsonGetString(araw,"market_regime");
               string sq=JsonGetString(araw,"session_quality_label");
               string rr=JsonGetString(araw,"rr_label");
               bool selected=false;
               JsonGetBool(araw,"selected",selected);
               string wy=ShortWyckoff(JsonGetString(araw,"wyckoff_phase"),JsonGetString(araw,"wyckoff_event"),JsonGetNumber(araw,"wyckoff_confidence"));
               if(InpShowAnalyzerFields){
                  info += " BS:"+IntegerToString(bs);
                  if(rg!="") info += " "+rg;
                  if(sq!="") info += " SQ:"+sq;
                  if(rr!="") info += " RR:"+rr;
                  if(wy!="") info += " ["+wy+"]";
                  if(selected) info += " *";
               }
            }
            if(shown<InpMaxSymbolsInLine){
               if(line!="") line += "\n";
               line += info;
            }
            shown++;
         }
      }
      cid=ChartNext(cid);
      guard++;
   }
   if(shown==0) return "No active Bull/Analyzer JSON";
   if(shown>InpMaxSymbolsInLine) line += "\n+"+IntegerToString(shown-InpMaxSymbolsInLine)+" more";
   return line;
}


bool UI_Create(){
   if(ObjectFind(0,UI_HEADER)>=0) ObjectDelete(0,UI_HEADER);
   if(ObjectFind(0,UI_LABEL)>=0) ObjectDelete(0,UI_LABEL);
   if(ObjectFind(0,UI_BTN)>=0) ObjectDelete(0,UI_BTN);

   ObjectCreate(0,UI_HEADER,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,UI_HEADER,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,UI_HEADER,OBJPROP_XDISTANCE,18);
   ObjectSetInteger(0,UI_HEADER,OBJPROP_YDISTANCE,18);
   ObjectSetInteger(0,UI_HEADER,OBJPROP_FONTSIZE,13);
   ObjectSetString(0,UI_HEADER,OBJPROP_FONT,"Consolas");
   ObjectSetInteger(0,UI_HEADER,OBJPROP_COLOR,clrWhite);
   ObjectSetString(0,UI_HEADER,OBJPROP_TEXT,"SOFTI EXECUTOR");

   ObjectCreate(0,UI_LABEL,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,UI_LABEL,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,UI_LABEL,OBJPROP_XDISTANCE,18);
   ObjectSetInteger(0,UI_LABEL,OBJPROP_YDISTANCE,42);
   ObjectSetInteger(0,UI_LABEL,OBJPROP_FONTSIZE,11);
   ObjectSetString(0,UI_LABEL,OBJPROP_FONT,"Consolas");
   ObjectSetInteger(0,UI_LABEL,OBJPROP_COLOR,clrWhite);

   ObjectCreate(0,UI_BTN,OBJ_BUTTON,0,0,0);
   ObjectSetInteger(0,UI_BTN,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,UI_BTN,OBJPROP_XDISTANCE,240);
   ObjectSetInteger(0,UI_BTN,OBJPROP_YDISTANCE,16);
   ObjectSetInteger(0,UI_BTN,OBJPROP_XSIZE,120);
   ObjectSetInteger(0,UI_BTN,OBJPROP_YSIZE,22);
   ObjectSetString(0,UI_BTN,OBJPROP_TEXT,"SWITCH MODE");
   ObjectSetInteger(0,UI_BTN,OBJPROP_COLOR,clrBlack);
   return true;
}
void UI_Update(){
   if(!InpShowLiveReport) return;
   string mode=(g_mode_runtime==0?"ANALYSIS":"TRADING");
   string account=(AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_DEMO?"DEMO":"LIVE");
   string market=(InpAllowCryptoSymbols?"FOREX+CRYPTO":"FOREX");
   string line=InpScanAllOpenCharts ? BuildCompactScanLine() : "Current chart only";
   string txt="";
   txt += "------------------------------\n";
   txt += "MODE: " + mode + "\n";
   txt += "ACCOUNT: " + account + "\n";
   txt += "MARKET: " + market + "\n";
   txt += "CONF MODE: " + (InpConfidenceMode==ALGO?"ALGO":"REAL") + "\n";
   txt += "WYCKOFF: " + (InpUseWyckoffEngine?"ON":"OFF") + "\n";
   txt += "LIQ/SESSION/RR: ON\n";
   txt += "\n";
   txt += "TOP OPPORTUNITIES\n";
   txt += line + "\n";
   txt += "\n";
   txt += "LAST UPDATE: " + TimeToString(g_last_update,TIME_DATE|TIME_SECONDS);
   ObjectSetString(0,UI_LABEL,OBJPROP_TEXT,txt);
}
void ToggleMode(){ if(g_mode_runtime==0) g_mode_runtime=1; else g_mode_runtime=0; LogPrint("MODE TOGGLED"); UI_Update(); }
int OnInit(){
   g_mode_runtime=(int)InpMode;
   ApplySellableTheme();
   UI_Create();
   g_last_update=TimeCurrent();
   if(InpEnableTimer) EventSetTimer(InpTimerSeconds);
   UI_Update();
   LogPrint("ENGINE STARTED");
   return(INIT_SUCCEEDED);
}
void OnDeinit(const int reason){ if(InpEnableTimer) EventKillTimer(); }
void OnTimer(){ g_last_update=TimeCurrent(); UI_Update(); LogPrint("TIMER TICK | scanned open charts"); }
void OnTick(){ g_last_update=TimeCurrent(); UI_Update(); }
void OnChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam){ if(id==CHARTEVENT_OBJECT_CLICK && sparam==UI_BTN) ToggleMode(); }
