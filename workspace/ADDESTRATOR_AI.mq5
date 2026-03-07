#property strict
#property version "2.905"
#property description "SOFTI AI ANALYZER - Data Collector"

enum STRATEGY_MODE { SCALPING=0, INTRADAY=1, SWING=2 };

input string InpServerUrl = "https://ais-dev-x44aeg6fnnfxq6bn72x4ki-235901768461.europe-west2.run.app/api/analyze";
input long InpSoftiMagic=988890;
input bool InpUseMagicFilter=false;
input bool InpUseCommentFilter=false;
input string InpCommentContains="BULL AI";
input bool InpEnableTimer=true;
input int InpTimerSeconds=10;
input bool InpEnableHistoryRecovery=true;
input bool InpEnableContext=true;
input bool InpWriteOrdersSnapshot=true;
input bool InpWritePositionsSnapshot=true;
input bool InpPrintLogs=true;
input bool InpShowPanel=true;
input bool InpScanBullSignals=true;
input bool InpIndexBullScreenshots=true;
input int InpScreenshotRetentionDays=7;

// Analyzer patch inputs (additive)
input STRATEGY_MODE InpStrategyMode=SCALPING;
input bool InpAutoBiasAlignment=true;
input bool InpShowBiasStrength=true;
input bool InpUseMarketRegime=true;
input bool InpUseLiquidityMap=true;
input bool InpUseOpportunityRanking=true;
input int InpMaxTradesPerScan=1;
input double InpMinConfidence=0.70;
input bool InpUseCorrelationFilter=true;
input double InpMaxCorrelationAllowed=0.75;
input bool InpHedgingMode=true;
input bool InpUseWyckoffEngine=false;
input bool InpAllowCryptoSymbols=true;
input bool InpAllowDemoAccounts=true;
input bool InpIgnoreSpreadInAnalysis=true;

string DATA_FOLDER="SOFTI_DATA\\";
string AI_FOLDER="BULL_AI\\";
string UI_BG="SOFTI_ADD_UI_BG";
string UI_HEADER="SOFTI_ADD_UI_HEADER";
string UI_LABEL="SOFTI_ADD_UI_LABEL";
datetime g_last_run=0;
int g_last_positions=0,g_last_orders=0,g_last_deals_saved=0,g_last_signals=0,g_last_shots=0;
ulong g_last_saved_deal=0;
int g_last_candidates=0,g_last_selected=0;
string g_top_summary="";

struct Candidate {
   string symbol;
   string base_action;
   double base_conf;
   string bias_w1;
   string bias_d1;
   string bias_h4;
   string bias_direction;
   string trigger_tf;
   int bias_strength;
   string market_regime;
   bool liquidity_above;
   bool liquidity_below;
   bool liquidity_sweep;
   string wyckoff_phase;
   string wyckoff_event;
   int wyckoff_conf;
   double confidence_score;
   bool aligned;
   bool selected;
   int rank;
   string reason;
};

// --- CORE FUNCTION: SEND TO FLASH ---
void SendToFlash(string jsonData) {
   char post[];
   char result[];
   string result_headers;
   ResetLastError();
   StringToCharArray(jsonData, post);
   int res = WebRequest("POST", InpServerUrl, "Content-Type: application/json\r\n", 5000, post, result, result_headers);
   if(res == -1) {
      Print("FLASH ERROR: ", GetLastError());
   } else if(res >= 200 && res < 300) {
      string responseText = CharArrayToString(result);
      string ai_resp = JsonGetString(responseText, "ai_response");
      if(ai_resp != "") {
         Print("SOFTI AI RESPONSE: ", ai_resp);
         Comment("SOFTI AI ANALYZER: ", ai_resp);
      }
   }
}

bool PassMagic(const long magic){if(!InpUseMagicFilter) return true; return (magic==InpSoftiMagic);}
bool PassComment(const string comment){if(!InpUseCommentFilter) return true; if(InpCommentContains=="") return true; return (StringFind(comment,InpCommentContains)>=0);}
void LogPrint(const string msg){if(InpPrintLogs) Print("SOFTI ADD | ",msg);}
string SanitizeSymbol(const string s){string x=s; StringReplace(x,".",""); StringReplace(x,"_",""); return x;}

bool ReadTextFile(const string relpath,string &out){
   out="";
   int h=FileOpen(relpath,FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE);
   if(h==INVALID_HANDLE) return false;
   while(!FileIsEnding(h)) out += FileReadString(h) + "\n";
   FileClose(h);
   return (StringLen(out)>0);
}
bool WriteTextFile(const string relpath,const string txt){
   int h=FileOpen(relpath,FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE);
   if(h==INVALID_HANDLE) return false;
   FileWriteString(h,txt);
   FileClose(h);
   return true;
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
   int e=s;
   while(e<StringLen(json)){
      int c=StringGetCharacter(json,e);
      if((c>='0'&&c<='9')||c=='.'||c=='-') e++; else break;
   }
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
bool AlreadySeen(string &arr[], int used, const string sym){for(int i=0;i<used;i++) if(arr[i]==sym) return true; return false;}

double GetIndicatorValue(const int handle){
   if(handle==INVALID_HANDLE) return 0.0;
   double buff[];
   ArraySetAsSeries(buff,true);
   if(CopyBuffer(handle,0,0,1,buff)<=0) return 0.0;
   return buff[0];
}
double GetATRtf(const string sym,const ENUM_TIMEFRAMES tf){
   if(!InpEnableContext) return 0.0;
   int h=iATR(sym,tf,14);
   return GetIndicatorValue(h);
}
double GetMAtf(const string sym,const ENUM_TIMEFRAMES tf,const int period){
   if(!InpEnableContext) return 0.0;
   int h=iMA(sym,tf,period,0,MODE_EMA,PRICE_CLOSE);
   return GetIndicatorValue(h);
}
double GetATR(const string sym){return GetATRtf(sym,PERIOD_M15);}
double GetMA(const string sym,const int period){return GetMAtf(sym,PERIOD_M15,period);}
string GetSession(){
   MqlDateTime dt; TimeToStruct(TimeCurrent(),dt);
   int h=dt.hour;
   if(h<7) return "ASIA";
   if(h<13) return "LONDON";
   if(h<21) return "NEWYORK";
   return "OFF";
}
string TfToString(const ENUM_TIMEFRAMES tf){
   if(tf==PERIOD_M15) return "M15";
   if(tf==PERIOD_M30) return "M30";
   if(tf==PERIOD_H1) return "H1";
   if(tf==PERIOD_H4) return "H4";
   if(tf==PERIOD_D1) return "D1";
   if(tf==PERIOD_W1) return "W1";
   return "TF";
}
ENUM_TIMEFRAMES StrategyBiasTf(){
   if(InpStrategyMode==SCALPING) return PERIOD_H4;
   if(InpStrategyMode==INTRADAY) return PERIOD_D1;
   return PERIOD_W1;
}
ENUM_TIMEFRAMES StrategyTriggerTf(){
   if(InpStrategyMode==SCALPING) return PERIOD_M15;
   if(InpStrategyMode==INTRADAY) return PERIOD_M30;
   return PERIOD_H1;
}
string GetBiasForTf(const string sym,const ENUM_TIMEFRAMES tf){
   double ma50=GetMAtf(sym,tf,50);
   double ma200=GetMAtf(sym,tf,200);
   if(ma50==0.0 || ma200==0.0) return "neutral";
   if(ma50>ma200) return "bullish";
   if(ma50<ma200) return "bearish";
   return "neutral";
}
bool IsAlignedDirection(const string a,const string b){
   if(a=="neutral" || b=="neutral") return false;
   return (a==b);
}
int CalcBiasStrength(const string dirW1,const string dirD1,const string dirH4,const string selected){
   int score=0;
   if(dirW1==selected) score+=40;
   if(dirD1==selected) score+=35;
   if(dirH4==selected) score+=25;
   return score;
}
bool GetRatesSafe(const string sym,const ENUM_TIMEFRAMES tf,const int bars,MqlRates &rates[]){
   ArraySetAsSeries(rates,true);
   int copied=CopyRates(sym,tf,0,bars,rates);
   return (copied>=bars);
}
double GetHH(const MqlRates &rates[],const int start,const int count){
   double hh=rates[start].high;
   for(int i=start;i<start+count;i++) if(rates[i].high>hh) hh=rates[i].high;
   return hh;
}
double GetLL(const MqlRates &rates[],const int start,const int count){
   double ll=rates[start].low;
   for(int i=start;i<start+count;i++) if(rates[i].low<ll) ll=rates[i].low;
   return ll;
}
string DetectMarketRegime(const string sym,const ENUM_TIMEFRAMES tf){
   if(!InpUseMarketRegime) return "OFF";
   MqlRates rates[];
   if(!GetRatesSafe(sym,tf,80,rates)) return "UNKNOWN";
   double atr=GetATRtf(sym,tf);
   double range_recent=GetHH(rates,1,20)-GetLL(rates,1,20);
   double range_prev=GetHH(rates,21,20)-GetLL(rates,21,20);
   double ma50=GetMAtf(sym,tf,50), ma200=GetMAtf(sym,tf,200);
   if(atr>0 && range_recent > atr*8.0) return "VOLATILE";
   if(range_prev>0 && range_recent < range_prev*0.85) return "ACCUMULATION";
   if(ma50>ma200 && rates[1].close>ma50) return "TREND";
   if(ma50<ma200 && rates[1].close<ma50) return "TREND";
   return "RANGE";
}
void DetectLiquidity(const string sym,const ENUM_TIMEFRAMES tf,bool &liqAbove,bool &liqBelow,bool &sweep){
   liqAbove=false; liqBelow=false; sweep=false;
   if(!InpUseLiquidityMap) return;
   MqlRates rates[];
   if(!GetRatesSafe(sym,tf,40,rates)) return;
   double prevHigh=GetHH(rates,5,20);
   double prevLow=GetLL(rates,5,20);
   double point=SymbolInfoDouble(sym,SYMBOL_POINT);
   double thr=point*15.0;
   liqAbove = (MathAbs(rates[2].high-prevHigh) <= thr) || (rates[1].high > prevHigh);
   liqBelow = (MathAbs(rates[2].low-prevLow) <= thr) || (rates[1].low < prevLow);
   bool spring = (rates[1].low < prevLow && rates[1].close > prevLow);
   bool upthrust = (rates[1].high > prevHigh && rates[1].close < prevHigh);
   sweep = spring || upthrust;
}
bool DetectSpring(const MqlRates &rates[],const int lookback){
   if(ArraySize(rates)<lookback+5) return false;
   double prev_low=GetLL(rates,5,lookback);
   return (rates[1].low<prev_low && rates[1].close>prev_low && rates[1].close>rates[1].open);
}
bool DetectUpthrust(const MqlRates &rates[],const int lookback){
   if(ArraySize(rates)<lookback+5) return false;
   double prev_high=GetHH(rates,5,lookback);
   return (rates[1].high>prev_high && rates[1].close<prev_high && rates[1].close<rates[1].open);
}
void EvalWyckoff(const string sym,string &phase,string &event_name,int &confidence){
   phase="NEUTRAL"; event_name="NONE"; confidence=0;
   if(!InpUseWyckoffEngine) return;
   MqlRates rH1[], rM15[];
   if(!GetRatesSafe(sym,PERIOD_H1,120,rH1) || !GetRatesSafe(sym,PERIOD_M15,80,rM15)) return;
   double h1_close_now=rH1[1].close, h1_close_old=rH1[30].close;
   double h1_range_recent=GetHH(rH1,1,20)-GetLL(rH1,1,20);
   double h1_range_prev=GetHH(rH1,21,20)-GetLL(rH1,21,20);
   bool compression=(h1_range_recent<h1_range_prev*0.85);
   bool spring=DetectSpring(rM15,20);
   bool upthrust=DetectUpthrust(rM15,20);
   double ma50=GetMA(sym,50), ma200=GetMA(sym,200);

   if(ma50>ma200 && h1_close_now>h1_close_old){ phase="MARKUP"; confidence=65; }
   else if(ma50<ma200 && h1_close_now<h1_close_old){ phase="MARKDOWN"; confidence=65; }
   else if(compression && ma50>=ma200){ phase="ACCUMULATION"; confidence=55; }
   else if(compression && ma50<ma200){ phase="DISTRIBUTION"; confidence=55; }

   if(phase=="ACCUMULATION" && spring){ event_name="SPRING"; confidence+=20; }
   else if(phase=="DISTRIBUTION" && upthrust){ event_name="UPTHRUST"; confidence+=20; }
   else if(phase=="MARKUP" && spring){ event_name="REACCUMULATION"; confidence+=10; }
   else if(phase=="MARKDOWN" && upthrust){ event_name="REDISTRIBUTION"; confidence+=10; }

   if(confidence>95) confidence=95;
}
double Clamp01(double v){ if(v<0.0) return 0.0; if(v>1.0) return 1.0; return v; }
double CalcConfidence(const Candidate &c){
   double score=0.0;
   if(c.aligned) score += 0.20;
   score += (double)c.bias_strength/100.0 * 0.15;
   if(c.market_regime=="TREND") score += 0.15;
   else if(c.market_regime=="ACCUMULATION") score += 0.10;
   else if(c.market_regime=="RANGE") score += 0.05;
   if(c.liquidity_above || c.liquidity_below) score += 0.10;
   if(c.liquidity_sweep) score += 0.10;
   if(InpUseWyckoffEngine && c.wyckoff_conf>0) score += ((double)c.wyckoff_conf/100.0)*0.10;
   score += c.base_conf*0.15;
   double atr=GetATR(c.symbol);
   if(atr>0) score += 0.05;
   return Clamp01(score);
}
double SymbolCorrelationHeuristic(const string a,const string b){
   if(StringLen(a)<6 || StringLen(b)<6) return 0.0;
   string a1=StringSubstr(a,0,3), a2=StringSubstr(a,3,3);
   string b1=StringSubstr(b,0,3), b2=StringSubstr(b,3,3);
   if(a1==b1 || a2==b2) return 0.85;
   if(a1==b2 || a2==b1) return -0.85;
   if(StringFind(a,"XAU")>=0 || StringFind(b,"XAU")>=0) return 0.20;
   return 0.0;
}
void SortCandidates(Candidate &arr[]){
   int n=ArraySize(arr);
   for(int i=0;i<n-1;i++){
      for(int j=i+1;j<n;j++){
         if(arr[j].confidence_score > arr[i].confidence_score){
            Candidate tmp=arr[i];
            arr[i]=arr[j];
            arr[j]=tmp;
         }
      }
   }
}
void ApplyRankingFilters(Candidate &arr[]){
   int n=ArraySize(arr);
   for(int i=0;i<n;i++) arr[i].selected=false;
   int selected=0;
   for(int i=0;i<n;i++){
      if(arr[i].confidence_score < InpMinConfidence) continue;
      bool allow=true;
      if(InpUseCorrelationFilter){
         for(int j=0;j<i;j++){
            if(!arr[j].selected) continue;
            double corr=SymbolCorrelationHeuristic(arr[i].symbol,arr[j].symbol);
            if(corr>=InpMaxCorrelationAllowed){ allow=false; break; }
         }
      }
      if(allow){
         arr[i].selected=true;
         selected++;
         if(InpMaxTradesPerScan>0 && selected>=InpMaxTradesPerScan) break;
      }
   }
}
string EscapeJson(const string s){
   string x=s;
   StringReplace(x,"\\","\\\\");
   StringReplace(x,"\"","\\\"");
   return x;
}
bool WriteAnalyzerJson(const Candidate &c){
   string path=AI_FOLDER+"analyzer_"+SanitizeSymbol(c.symbol)+".json";
   string json="{\n";
   json += "  \"symbol\": \""+EscapeJson(c.symbol)+"\",\n";
   json += "  \"action\": \""+EscapeJson(c.base_action)+"\",\n";
   json += "  \"base_confidence\": "+DoubleToString(c.base_conf,2)+",\n";
   json += "  \"bias_direction\": \""+EscapeJson(c.bias_direction)+"\",\n";
   json += "  \"trigger_tf\": \""+EscapeJson(c.trigger_tf)+"\",\n";
   json += "  \"bias_strength\": "+IntegerToString(c.bias_strength)+",\n";
   json += "  \"market_regime\": \""+EscapeJson(c.market_regime)+"\",\n";
   json += "  \"liquidity_above\": "+(c.liquidity_above?"true":"false")+",\n";
   json += "  \"liquidity_below\": "+(c.liquidity_below?"true":"false")+",\n";
   json += "  \"liquidity_sweep\": "+(c.liquidity_sweep?"true":"false")+",\n";
   json += "  \"wyckoff_phase\": \""+EscapeJson(c.wyckoff_phase)+"\",\n";
   json += "  \"wyckoff_event\": \""+EscapeJson(c.wyckoff_event)+"\",\n";
   json += "  \"wyckoff_confidence\": "+IntegerToString(c.wyckoff_conf)+",\n";
   json += "  \"confidence_score\": "+DoubleToString(c.confidence_score,2)+",\n";
   json += "  \"aligned\": "+(c.aligned?"true":"false")+",\n";
   json += "  \"selected\": "+(c.selected?"true":"false")+",\n";
   json += "  \"rank\": "+IntegerToString(c.rank)+",\n";
   json += "  \"reason\": \""+EscapeJson(c.reason)+"\"\n";
   json += "}\n";
   
   // SEND TO FLASH AI
   SendToFlash(json);
   
   return WriteTextFile(path,json);
}
void WriteAnalyzerOutputs(Candidate &arr[]){
   string f1=DATA_FOLDER+"market_snapshot.csv";
   int h1=FileOpen(f1,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_WRITE);
   if(h1!=INVALID_HANDLE){
      FileWrite(h1,"symbol","action","base_conf","bias_direction","trigger_tf","bias_strength","market_regime","liquidity_above","liquidity_below","liquidity_sweep","wyckoff_phase","wyckoff_event","wyckoff_conf","confidence_score","aligned","selected","rank","reason");
      for(int i=0;i<ArraySize(arr);i++){
         FileWrite(h1,arr[i].symbol,arr[i].base_action,DoubleToString(arr[i].base_conf,2),arr[i].bias_direction,arr[i].trigger_tf,arr[i].bias_strength,arr[i].market_regime,(arr[i].liquidity_above?"true":"false"),(arr[i].liquidity_below?"true":"false"),(arr[i].liquidity_sweep?"true":"false"),arr[i].wyckoff_phase,arr[i].wyckoff_event,arr[i].wyckoff_conf,DoubleToString(arr[i].confidence_score,2),(arr[i].aligned?"true":"false"),(arr[i].selected?"true":"false"),arr[i].rank,arr[i].reason);
         WriteAnalyzerJson(arr[i]);
      }
      FileClose(h1);
   }
   string f2=DATA_FOLDER+"ranked_opportunities.csv";
   int h2=FileOpen(f2,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_WRITE);
   if(h2!=INVALID_HANDLE){
      FileWrite(h2,"rank","symbol","confidence_score","selected","reason");
      for(int j=0;j<ArraySize(arr);j++) FileWrite(h2,arr[j].rank,arr[j].symbol,DoubleToString(arr[j].confidence_score,2),(arr[j].selected?"true":"false"),arr[j].reason);
      FileClose(h2);
   }
}
bool BuildCandidateForSymbol(const string sym,Candidate &c){
   string raw="";
   string json_path=AI_FOLDER+"last_signal_"+SanitizeSymbol(sym)+".json";
   if(!ReadTextFile(json_path,raw)) return false;

   c.symbol=sym;
   c.base_action=JsonGetString(raw,"action");
   if(c.base_action=="") c.base_action="wait";
   c.base_conf=JsonGetNumber(raw,"confidence_score");
   if(c.base_conf<0) c.base_conf=0.0;

   c.bias_w1=GetBiasForTf(sym,PERIOD_W1);
   c.bias_d1=GetBiasForTf(sym,PERIOD_D1);
   c.bias_h4=GetBiasForTf(sym,PERIOD_H4);

   ENUM_TIMEFRAMES biasTf=StrategyBiasTf();
   ENUM_TIMEFRAMES trigTf=StrategyTriggerTf();
   c.trigger_tf=TfToString(trigTf);

   if(biasTf==PERIOD_H4) c.bias_direction=c.bias_h4;
   else if(biasTf==PERIOD_D1) c.bias_direction=c.bias_d1;
   else c.bias_direction=c.bias_w1;

   c.aligned=true;
   if(InpAutoBiasAlignment){
      if(c.bias_direction=="bullish"){
         c.aligned = (c.bias_h4=="bullish" || biasTf==PERIOD_H4) && (c.bias_d1=="bullish" || biasTf==PERIOD_D1) && (c.bias_w1=="bullish" || biasTf==PERIOD_W1);
      }else if(c.bias_direction=="bearish"){
         c.aligned = (c.bias_h4=="bearish" || biasTf==PERIOD_H4) && (c.bias_d1=="bearish" || biasTf==PERIOD_D1) && (c.bias_w1=="bearish" || biasTf==PERIOD_W1);
      }else c.aligned=false;
   }

   c.bias_strength=CalcBiasStrength(c.bias_w1,c.bias_d1,c.bias_h4,c.bias_direction);
   c.market_regime=DetectMarketRegime(sym,trigTf);
   DetectLiquidity(sym,trigTf,c.liquidity_above,c.liquidity_below,c.liquidity_sweep);
   EvalWyckoff(sym,c.wyckoff_phase,c.wyckoff_event,c.wyckoff_conf);

   c.reason = c.bias_direction+"|"+c.market_regime;
   if(c.liquidity_sweep) c.reason += "|SWEEP";
   if(InpUseWyckoffEngine && c.wyckoff_event!="NONE") c.reason += "|"+c.wyckoff_event;

   c.confidence_score=CalcConfidence(c);
   c.rank=0;
   c.selected=false;
   return true;
}


void DrawPanel(){
   if(!InpShowPanel) return;
   if(ObjectFind(0,UI_BG)>=0) ObjectDelete(0,UI_BG);
   if(ObjectFind(0,UI_HEADER)>=0) ObjectDelete(0,UI_HEADER);
   if(ObjectFind(0,UI_LABEL)>=0) ObjectDelete(0,UI_LABEL);

   ObjectCreate(0,UI_BG,OBJ_RECTANGLE_LABEL,0,0,0);
   ObjectSetInteger(0,UI_BG,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,UI_BG,OBJPROP_XDISTANCE,14);
   ObjectSetInteger(0,UI_BG,OBJPROP_YDISTANCE,18);
   ObjectSetInteger(0,UI_BG,OBJPROP_XSIZE,360);
   ObjectSetInteger(0,UI_BG,OBJPROP_YSIZE,230);
   ObjectSetInteger(0,UI_BG,OBJPROP_BGCOLOR,clrGold);
   ObjectSetInteger(0,UI_BG,OBJPROP_COLOR,clrBlack);
   ObjectSetInteger(0,UI_BG,OBJPROP_BORDER_TYPE,BORDER_FLAT);
   ObjectSetInteger(0,UI_BG,OBJPROP_WIDTH,1);
   ObjectSetInteger(0,UI_BG,OBJPROP_BACK,false);
   ObjectSetInteger(0,UI_BG,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,UI_BG,OBJPROP_HIDDEN,true);

   ObjectCreate(0,UI_HEADER,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,UI_HEADER,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,UI_HEADER,OBJPROP_XDISTANCE,28);
   ObjectSetInteger(0,UI_HEADER,OBJPROP_YDISTANCE,28);
   ObjectSetInteger(0,UI_HEADER,OBJPROP_FONTSIZE,13);
   ObjectSetString(0,UI_HEADER,OBJPROP_FONT,"Consolas");
   ObjectSetInteger(0,UI_HEADER,OBJPROP_COLOR,clrBlack);
   ObjectSetString(0,UI_HEADER,OBJPROP_TEXT,"SOFTI AI ANALYZER");

   ObjectCreate(0,UI_LABEL,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,UI_LABEL,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,UI_LABEL,OBJPROP_XDISTANCE,28);
   ObjectSetInteger(0,UI_LABEL,OBJPROP_YDISTANCE,56);
   ObjectSetInteger(0,UI_LABEL,OBJPROP_FONTSIZE,11);
   ObjectSetString(0,UI_LABEL,OBJPROP_FONT,"Consolas");
   ObjectSetInteger(0,UI_LABEL,OBJPROP_COLOR,clrBlack);
}
void UpdatePanel(){
   if(!InpShowPanel) return;
   string strategy=(InpStrategyMode==SCALPING?"SCALPING":(InpStrategyMode==INTRADAY?"INTRADAY":"SWING"));
   string account=(AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_DEMO?"DEMO":"LIVE");
   string market=(InpAllowCryptoSymbols?"FOREX+CRYPTO":"FOREX");
   string txt="";
   txt += "------------------------------\n";
   txt += "MODE: ANALYSIS\n";
   txt += "STRATEGY: " + strategy + "\n";
   txt += "ACCOUNT: " + account + "\n";
   txt += "MARKET: " + market + "\n";
   txt += "\n";
   txt += "SIGNALS: " + IntegerToString(g_last_signals) + "\n";
   txt += "CANDIDATES: " + IntegerToString(g_last_candidates) + "\n";
   txt += "SELECTED: " + IntegerToString(g_last_selected) + "\n";
   txt += "\n";
   txt += "BIAS: " + (InpAutoBiasAlignment?"ALIGNED":"RAW") + "\n";
   txt += "WYCKOFF: " + (InpUseWyckoffEngine?"ON":"OFF") + "\n";
   txt += "\n";
   txt += "TOP SETUPS\n";
   txt += g_top_summary;
   ObjectSetString(0,UI_LABEL,OBJPROP_TEXT,txt);
}

int OnInit(){
   FolderCreate(DATA_FOLDER);
   FolderCreate(AI_FOLDER);
   DrawPanel();
   g_last_run=TimeCurrent();
   if(InpEnableTimer) EventSetTimer(InpTimerSeconds);
   LogPrint("SOFTI AI ANALYZER - ADDESTRATOR STARTED");
   UpdatePanel();
   return(INIT_SUCCEEDED);
}
void OnDeinit(const int reason){if(InpEnableTimer) EventKillTimer();}

void SavePositionsSnapshot(){
   if(!InpWritePositionsSnapshot) return;
   string file=DATA_FOLDER+"positions_snapshot.csv";
   int h=FileOpen(file,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_WRITE);
   if(h==INVALID_HANDLE) return;
   FileWrite(h,"symbol","ticket","magic","comment","type","volume","entry_price","stop_loss","take_profit","profit","swap","atr_m15_14","ma50_ema_m15","ma200_ema_m15","session");
   int total=PositionsTotal(); g_last_positions=0;
   for(int i=0;i<total;i++){
      ulong ticket=PositionGetTicket(i); if(ticket==0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      string symbol=PositionGetString(POSITION_SYMBOL);
      long magic=(long)PositionGetInteger(POSITION_MAGIC);
      string comment=PositionGetString(POSITION_COMMENT);
      if(!PassMagic(magic)) continue;
      if(!PassComment(comment)) continue;
      long type=PositionGetInteger(POSITION_TYPE);
      string dir=(type==POSITION_TYPE_SELL?"SELL":"BUY");
      double volume=PositionGetDouble(POSITION_VOLUME);
      double entry=PositionGetDouble(POSITION_PRICE_OPEN);
      double sl=PositionGetDouble(POSITION_SL);
      double tp=PositionGetDouble(POSITION_TP);
      double profit=PositionGetDouble(POSITION_PROFIT);
      double swap=PositionGetDouble(POSITION_SWAP);
      FileWrite(h,symbol,(long)ticket,magic,comment,dir,volume,entry,sl,tp,profit,swap,GetATR(symbol),GetMA(symbol,50),GetMA(symbol,200),GetSession());
      g_last_positions++;
   }
   FileClose(h);
}
void SaveOrdersSnapshot(){
   if(!InpWriteOrdersSnapshot) return;
   string file=DATA_FOLDER+"orders_snapshot.csv";
   int h=FileOpen(file,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_WRITE);
   if(h==INVALID_HANDLE) return;
   FileWrite(h,"symbol","ticket","magic","comment","order_type","order_state","volume_initial","price_open","stop_loss","take_profit","time_setup");
   int total=OrdersTotal(); g_last_orders=0;
   for(int i=0;i<total;i++){
      ulong ticket=OrderGetTicket(i); if(ticket==0) continue;
      if(!OrderSelect(ticket)) continue;
      string symbol=OrderGetString(ORDER_SYMBOL);
      long magic=(long)OrderGetInteger(ORDER_MAGIC);
      string comment=OrderGetString(ORDER_COMMENT);
      if(!PassMagic(magic)) continue;
      if(!PassComment(comment)) continue;
      long type=OrderGetInteger(ORDER_TYPE);
      long state=OrderGetInteger(ORDER_STATE);
      double volume=OrderGetDouble(ORDER_VOLUME_INITIAL);
      double price=OrderGetDouble(ORDER_PRICE_OPEN);
      double sl=OrderGetDouble(ORDER_SL);
      double tp=OrderGetDouble(ORDER_TP);
      datetime t=(datetime)OrderGetInteger(ORDER_TIME_SETUP);
      FileWrite(h,symbol,(long)ticket,magic,comment,(long)type,(long)state,volume,price,sl,tp,TimeToString(t,TIME_DATE|TIME_SECONDS));
      g_last_orders++;
   }
   FileClose(h);
}
bool ResolveMetaFromPositionHistory(const long position_id,long &resolved_magic,string &resolved_comment){
   resolved_magic=0; resolved_comment="";
   if(!HistorySelect(0,TimeCurrent())) return false;
   int total=HistoryDealsTotal();
   for(int i=0;i<total;i++){
      ulong deal=HistoryDealGetTicket(i); if(deal==0) continue;
      if(!HistoryDealSelect(deal)) continue;
      long pid=HistoryDealGetInteger(deal,DEAL_POSITION_ID); if(pid!=position_id) continue;
      long m=(long)HistoryDealGetInteger(deal,DEAL_MAGIC);
      string c=HistoryDealGetString(deal,DEAL_COMMENT);
      if(m!=0 && resolved_magic==0) resolved_magic=m;
      if(c!="" && resolved_comment!="") resolved_comment=c;
      if(resolved_magic!=0 && resolved_comment!="") return true;
   }
   return (resolved_magic!=0 || resolved_comment!="");
}
void SaveDeal(const ulong deal){
   if(deal==0||deal<=g_last_saved_deal) return;
   if(!HistoryDealSelect(deal)) return;
   string symbol=HistoryDealGetString(deal,DEAL_SYMBOL);
   long deal_type=(long)HistoryDealGetInteger(deal,DEAL_TYPE);
   long deal_entry=(long)HistoryDealGetInteger(deal,DEAL_ENTRY);
   long magic=(long)HistoryDealGetInteger(deal,DEAL_MAGIC);
   string comment=HistoryDealGetString(deal,DEAL_COMMENT);
   long position_id=HistoryDealGetInteger(deal,DEAL_POSITION_ID);
   long resolved_magic=magic; string resolved_comment=comment;
   if(resolved_magic==0 || resolved_comment=="") ResolveMetaFromPositionHistory(position_id,resolved_magic,resolved_comment);
   if(symbol=="") return;
   if(deal_type!=DEAL_TYPE_BUY && deal_type!=DEAL_TYPE_SELL) return;
   if(deal_entry!=DEAL_ENTRY_IN && deal_entry!=DEAL_ENTRY_OUT && deal_entry!=DEAL_ENTRY_INOUT) return;
   if(!PassMagic(resolved_magic)) return;
   if(!PassComment(resolved_comment)) return;
   string file=DATA_FOLDER+"dataset_trades.csv";
   int h=FileOpen(file,FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_WRITE);
   if(h==INVALID_HANDLE) h=FileOpen(file,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_WRITE);
   if(h==INVALID_HANDLE) return;
   bool write_header=(FileSize(h)==0);
   if(write_header) FileWrite(h,"event_type","symbol","deal_ticket","position_id","time","entry","direction","price","volume","profit","swap","commission","magic","comment","resolved_magic","resolved_comment","atr_m15_14","ma50_ema_m15","ma200_ema_m15","session");
   FileSeek(h,0,SEEK_END);
   string entry="OTHER"; if(deal_entry==DEAL_ENTRY_IN) entry="IN"; else if(deal_entry==DEAL_ENTRY_OUT) entry="OUT"; else if(deal_entry==DEAL_ENTRY_INOUT) entry="INOUT";
   string direction=(deal_type==DEAL_TYPE_SELL?"SELL":"BUY");
   double price=HistoryDealGetDouble(deal,DEAL_PRICE);
   double volume=HistoryDealGetDouble(deal,DEAL_VOLUME);
   double profit=HistoryDealGetDouble(deal,DEAL_PROFIT);
   double swap=HistoryDealGetDouble(deal,DEAL_SWAP);
   double commission=HistoryDealGetDouble(deal,DEAL_COMMISSION);
   datetime t=(datetime)HistoryDealGetInteger(deal,DEAL_TIME);
   FileWrite(h,"DEAL_ADD",symbol,(long)deal,position_id,TimeToString(t,TIME_DATE|TIME_SECONDS),entry,direction,price,volume,profit,swap,commission,magic,comment,resolved_magic,resolved_comment,GetATR(symbol),GetMA(symbol,50),GetMA(symbol,200),GetSession());
   FileClose(h);
   g_last_saved_deal=deal; g_last_deals_saved++;
}
void ScanHistoryDeals(){
   if(!HistorySelect(0,TimeCurrent())) return;
   int total=HistoryDealsTotal();
   for(int i=0;i<total;i++){
      ulong deal=HistoryDealGetTicket(i);
      if(deal==0) continue;
      SaveDeal(deal);
   }
}
void ScanBullSignalsFromOpenCharts(){
   if(!InpScanBullSignals) return;
   string signals_file=DATA_FOLDER+"signals_snapshot.csv";
   int h=FileOpen(signals_file,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_WRITE);
   if(h==INVALID_HANDLE) return;
   FileWrite(h,"symbol","scan_time","action","confidence_score","aligned","htf_bias","ltf_structure","current_price","json_path","signal_status");
   g_last_signals=0;
   string seen[]; ArrayResize(seen,50); int used=0;
   Candidate arr[]; ArrayResize(arr,0);

   long cid=ChartFirst(); int guard=0;
   while(cid>=0 && guard<50){
      string sym=ChartSymbol(cid);
      if(sym!="" && !AlreadySeen(seen,used,sym)){
         seen[used]=sym; used++;
         string json_path=AI_FOLDER+"last_signal_"+SanitizeSymbol(sym)+".json";
         string raw="";
         if(ReadTextFile(json_path,raw)){
            string action=JsonGetString(raw,"action");
            double conf=JsonGetNumber(raw,"confidence_score");
            string htf=JsonGetString(raw,"htf_bias");
            string ltf=JsonGetString(raw,"ltf_structure");
            double current_price=JsonGetNumber(raw,"current_price");
            bool aligned=false; string aligned_str="false";
            if(JsonGetBool(raw,"aligned",aligned)) aligned_str=(aligned?"true":"false");
            FileWrite(h,sym,TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS),action,DoubleToString(conf,2),aligned_str,htf,ltf,current_price,json_path,"fresh");
            g_last_signals++;

            Candidate c;
            if(BuildCandidateForSymbol(sym,c)){
               int n=ArraySize(arr);
               ArrayResize(arr,n+1);
               arr[n]=c;
            }
         }
      }
      cid=ChartNext(cid); guard++;
   }
   FileClose(h);

   g_last_candidates=ArraySize(arr);
   if(g_last_candidates>0){
      SortCandidates(arr);
      for(int i=0;i<ArraySize(arr);i++) arr[i].rank=i+1;
      ApplyRankingFilters(arr);
      g_last_selected=0;
      g_top_summary="";
      for(int j=0;j<ArraySize(arr);j++){
         if(j<3){
            if(g_top_summary!="") g_top_summary += " | ";
            g_top_summary += arr[j].symbol+" "+DoubleToString(arr[j].confidence_score,2);
         }
         if(arr[j].selected) g_last_selected++;
      }
      WriteAnalyzerOutputs(arr);
   }else{
      g_last_selected=0;
      g_top_summary="no candidates";
   }
}
void IndexBullScreenshots(){
   if(!InpIndexBullScreenshots) return;
   string file=DATA_FOLDER+"screenshots_snapshot.csv";
   int h=FileOpen(file,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_WRITE);
   if(h==INVALID_HANDLE) return;
   FileWrite(h,"symbol","scan_time","png_expected_path","png_status","retention_days");
   g_last_shots=0;
   string seen[]; ArrayResize(seen,50); int used=0;
   long cid=ChartFirst(); int guard=0;
   while(cid>=0 && guard<50){
      string sym=ChartSymbol(cid);
      if(sym!="" && !AlreadySeen(seen,used,sym)){
         seen[used]=sym; used++;
         string shot_path=AI_FOLDER+"screenshots\\"+SanitizeSymbol(sym)+".png";
         FileWrite(h,sym,TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS),shot_path,"indexed",InpScreenshotRetentionDays);
         g_last_shots++;
      }
      cid=ChartNext(cid); guard++;
   }
   FileClose(h);
}
void OnTimer(){
   g_last_run=TimeCurrent();
   SavePositionsSnapshot();
   SaveOrdersSnapshot();
   if(InpEnableHistoryRecovery) ScanHistoryDeals();
   ScanBullSignalsFromOpenCharts();
   IndexBullScreenshots();
   UpdatePanel();
}
void OnTradeTransaction(const MqlTradeTransaction& trans,const MqlTradeRequest& request,const MqlTradeResult& result){
   if(trans.type==TRADE_TRANSACTION_DEAL_ADD){
      SaveDeal(trans.deal);
      UpdatePanel();
   }
}
