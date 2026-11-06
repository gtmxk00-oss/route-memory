package kr.routememory.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import kr.routememory.core.DriveCoach.Action;
import kr.routememory.core.DriveCoach.Decision;
import kr.routememory.core.DriveCoach.DriverType;
import kr.routememory.core.DriveCoach.Profile;
import kr.routememory.core.DriveCoach.Signal;
import kr.routememory.core.DriveCoach.Turn;
import kr.routememory.core.DriveCoach.TurnType;

/** Virtual scenes for the companion demo, matching RouteMemory-PC src/coach-demo.js. All signals are simulated. */
public final class CoachDemo {
    private static final double QUESTION_SECONDS=3.2,RESULT_SECONDS=1,REROUTE_SECONDS=1.2,PASSENGER_LEAVES_SECONDS=1.6,SPEAK_SECONDS=4.4;
    private static final String ASK="아까 그 출구, 놓치셨나요?";
    public enum Outcome {NONE,PASS,MISS}
    public enum Phase {CARD,DRIVING,PASSED,REROUTING,QUESTION_WAITING,QUESTION,LEARNED,MEMO,MEMO_SAVED}

    public static final class Scene {
        public String id,tag,title,lead,narration,question,memo,memoText,point;
        public DriverType driver; public Turn turn; public Outcome outcome=Outcome.NONE;
        public int from,signalAt,pointMeters; public double driveSeconds,seconds;
        public boolean passenger,noRoute,card; public Signal signalSide=Signal.OFF;
    }
    public static final class Event {
        public final double at; public final boolean alert; public final String text;
        Event(double at,boolean alert,String text){this.at=at;this.alert=alert;this.text=text;}
    }
    public static final class State {
        public Scene scene; public int index,meters=-1,limit,places; public double seconds;
        public Phase phase=Phase.DRIVING; public Signal signal=Signal.OFF; public boolean passenger,speaking;
        public Action action=Action.NONE; public String spoken=""; public List<String> weak=new ArrayList<>();
    }
    private static Scene card(String id,String title,String lead,double seconds,String narration) {
        Scene s=new Scene();s.id=id;s.card=true;s.title=title;s.lead=lead;s.seconds=seconds;s.narration=narration;return s;
    }
    private static Scene drive(String id,String tag,DriverType driver,String turnId,TurnType type,int from,double driveSeconds,Outcome outcome,double seconds,String narration) {
        Scene s=new Scene();s.id=id;s.tag=tag;s.driver=driver;s.turn=new Turn(turnId,type);s.from=from;s.driveSeconds=driveSeconds;
        s.outcome=outcome;s.seconds=seconds;s.narration=narration;
        if(outcome==Outcome.MISS)s.question=ASK;
        return s;
    }
    private static final List<Scene> SCENES=build();
    private static List<Scene> build() {
        List<Scene> list=new ArrayList<>();
        list.add(card("intro","길기억","놓친 길을 기억해, 필요할 때만 말합니다",13,"길기억은 운전자가 놓친 곳과 약한 회전 유형을 기억해, 필요할 때만 말하는 차량용 앱입니다. 이 영상은 가상 신호로 동작하는 시연입니다."));
        list.add(drive("miss-1","일반 · 평소 주행",DriverType.GENERAL,"exit-a",TurnType.EXIT_LEFT,900,5,Outcome.MISS,20,"왼쪽 출구를 놓치면 내비게이션이 재탐색합니다. 길기억은 주행 중에 끼어들지 않고, 정차한 뒤 운전자에게 확인합니다."));
        list.add(drive("miss-2","일반 · 다른 길",DriverType.GENERAL,"exit-b",TurnType.EXIT_LEFT,900,4,Outcome.MISS,17,"다른 길에서도 왼쪽 출구를 놓쳤다고 확인하면, 왼쪽 출구가 이 운전자의 약한 유형이 됩니다."));
        list.add(drive("speak","일반 · 첫 출장길",DriverType.GENERAL,"exit-c",TurnType.EXIT_LEFT,1000,6,Outcome.PASS,15,"처음 가는 길이어도 약한 유형이 다가오는데 방향지시등이 꺼져 있으면, 한 문장으로 알립니다."));
        Scene silent=drive("silent","일반 · 첫 출장길",DriverType.GENERAL,"exit-d",TurnType.EXIT_LEFT,1000,6,Outcome.PASS,15,"운전자가 먼저 방향지시등을 켜면 준비한 것으로 보고, 아무 말도 하지 않습니다.");
        silent.signalAt=800;silent.signalSide=Signal.LEFT;list.add(silent);
        Scene taxi=drive("taxi","택시 · 승객 탑승",DriverType.TAXI,"exit-t",TurnType.EXIT_LEFT,700,5,Outcome.MISS,20,"택시 유형은 승객이 타면 지난 실수를 말하지 않습니다. 확인 질문도 승객이 내린 뒤로 미룹니다.");
        taxi.passenger=true;list.add(taxi);
        list.add(drive("truck","화물 · 처음 가는 물류센터",DriverType.TRUCK,"exit-r",TurnType.EXIT_RIGHT,1000,6,Outcome.PASS,16,"화물 유형은 큰 차체를 고려해 더 일찍 판단합니다. 기본 판단 거리가 일반의 두 배인 600미터입니다."));
        list.add(drive("narrow","화물 · 주의 구간",DriverType.TRUCK,"narrow-1",TurnType.NARROW_ROAD,900,5,Outcome.PASS,13,"내비게이션의 주의 지점 정보와 결합해, 좁은 길도 미리 알립니다."));
        Scene memo=new Scene();memo.id="bus-memo";memo.tag="버스 · 새 노선";memo.driver=DriverType.BUS;memo.memo="bus-point";memo.memoText="여기 헷갈려";memo.noRoute=true;memo.passenger=true;memo.seconds=9;
        memo.narration="새 노선에 배치된 기사가 헷갈린 곳에서 음성으로 메모를 남깁니다.";list.add(memo);
        Scene remind=new Scene();remind.id="bus-remind";remind.tag="버스 · 다음 운행";remind.driver=DriverType.BUS;remind.point="bus-point";remind.from=400;remind.driveSeconds=5;remind.pointMeters=300;remind.noRoute=true;remind.passenger=true;remind.seconds=14;
        remind.narration="내비게이션 경로가 없어도, 다음 운행 때 그 지점에 다가가면 위치를 기준으로 알립니다.";list.add(remind);
        list.add(card("outro","사람, 차량, 업무에 맞춰 말합니다","현재는 가상 시연이며, Pleos Connect SDK 연동은 2차 심사 전까지 진행합니다",14,"길기억은 사람과 차량, 업무에 맞춰 말합니다. 현재는 가상 시연 단계이며, Pleos Connect SDK 연동은 2차 심사 전까지 진행합니다."));
        return Collections.unmodifiableList(list);
    }
    public static List<Scene> scenes(){return SCENES;}
    public static double total(){double sum=0;for(Scene s:SCENES)sum+=s.seconds;return sum;}
    public static double startOf(int index){double sum=0;for(int i=0;i<index;i++)sum+=SCENES.get(i).seconds;return sum;}

    private static Map<DriverType,Profile> seed() {
        Map<DriverType,Profile> profiles=new EnumMap<>(DriverType.class);
        for(DriverType type:DriverType.values())profiles.put(type,new Profile(type.name(),type.label,type));
        DriveCoach.chooseWeak(profiles.get(DriverType.TAXI),TurnType.EXIT_LEFT);
        DriveCoach.addMemo(profiles.get(DriverType.TAXI),"exit-t");
        DriveCoach.chooseWeak(profiles.get(DriverType.TRUCK),TurnType.EXIT_RIGHT);
        DriveCoach.chooseWeak(profiles.get(DriverType.TRUCK),TurnType.NARROW_ROAD);
        return profiles;
    }
    private static int metersAt(Scene s,double seconds){return (int)Math.round(s.from*Math.max(0,1-seconds/s.driveSeconds));}
    private static Signal signalAt(Scene s,int meters){return s.signalAt>0&&meters<=s.signalAt?s.signalSide:Signal.OFF;}
    private static Decision decision(Scene s,Profile p,int meters) {
        if(s.point!=null)return meters<=s.pointMeters?DriveCoach.decidePoint(p,s.point):new Decision(Action.WAIT,"too-far","",s.pointMeters);
        return DriveCoach.decide(p,s.turn,meters,signalAt(s,meters),s.passenger);
    }
    private static double alertSeconds(Scene s,Profile p) {
        if(s.from==0)return -1;
        for(int step=0;step*0.05<=s.driveSeconds;step++)
            if(decision(s,p,metersAt(s,step*0.05)).action==Action.SPEAK)return Math.round(step*5)/100.0;
        return -1;
    }
    private static double askSeconds(Scene s){return s.driveSeconds+REROUTE_SECONDS+(s.passenger?PASSENGER_LEAVES_SECONDS:0);}
    private static double narrationSeconds(Scene s) {
        if(s.card)return 0.6;
        if(s.memo!=null)return 2.4;
        return s.question!=null?askSeconds(s)+QUESTION_SECONDS:s.driveSeconds+RESULT_SECONDS;
    }
    private static void finish(Scene s,Profile p) {
        if(s.memo!=null)DriveCoach.addMemo(p,s.memo);
        if(s.outcome==Outcome.PASS)DriveCoach.notePass(p,s.turn,s.signalAt);
        if(s.outcome==Outcome.MISS){DriveCoach.noteMiss(p,s.turn);DriveCoach.review(p,true);}
    }
    private static void learned(State state,Profile p){state.weak=DriveCoach.weakLabels(p);state.places=p.placeCount();}

    public static State stateAt(double seconds) {
        Map<DriverType,Profile> profiles=seed();
        double time=Math.min(Math.max(seconds,0),total()-0.001),start=0;
        for(int i=0;i<SCENES.size();i++) {
            Scene s=SCENES.get(i);
            Profile p=s.driver==null?null:profiles.get(s.driver);
            if(time>=start+s.seconds){if(p!=null)finish(s,p);start+=s.seconds;continue;}
            State state=new State();state.scene=s;state.index=i;state.seconds=time-start;state.passenger=s.passenger;
            double u=state.seconds;
            if(s.card){state.phase=Phase.CARD;return state;}
            if(s.memo!=null) {
                boolean saved=u>=1.6;
                if(saved)DriveCoach.addMemo(p,s.memo);
                state.phase=saved?Phase.MEMO_SAVED:Phase.MEMO;learned(state,p);return state;
            }
            double alertAt=alertSeconds(s,p);
            state.meters=metersAt(s,Math.min(u,s.driveSeconds));
            state.signal=signalAt(s,state.meters);
            state.limit=s.turn!=null?DriveCoach.decisionMeters(p,s.turn):s.pointMeters;
            state.action=decision(s,p,state.meters).action;
            state.spoken=alertAt<0?"":decision(s,p,metersAt(s,alertAt)).speech;
            state.speaking=alertAt>=0&&u>=alertAt&&u<alertAt+SPEAK_SECONDS;
            learned(state,p);
            if(u>=s.driveSeconds) {
                if(s.question==null){state.phase=Phase.PASSED;return state;}
                double ask=askSeconds(s);
                state.passenger=s.passenger&&u<s.driveSeconds+REROUTE_SECONDS+PASSENGER_LEAVES_SECONDS*0.6;
                if(u<s.driveSeconds+REROUTE_SECONDS)state.phase=Phase.REROUTING;
                else if(u<ask)state.phase=Phase.QUESTION_WAITING;
                else if(u<ask+QUESTION_SECONDS)state.phase=Phase.QUESTION;
                else {
                    finish(s,p);state.phase=Phase.LEARNED;learned(state,p);
                    state.limit=DriveCoach.decisionMeters(p,s.turn);
                }
            }
            return state;
        }
        throw new IllegalStateException("Timeline ended without a scene");
    }
    /** Timed speech in time order. */
    public static List<Event> events() {
        Map<DriverType,Profile> profiles=seed();
        List<Event> list=new ArrayList<>();
        double start=0;
        for(Scene s:SCENES) {
            Profile p=s.driver==null?null:profiles.get(s.driver);
            if(p!=null&&s.memo==null) {
                double alertAt=alertSeconds(s,p);
                if(alertAt>=0)list.add(new Event(start+alertAt,true,decision(s,p,metersAt(s,alertAt)).speech));
            }
            if(s.question!=null)list.add(new Event(start+askSeconds(s),true,s.question));
            list.add(new Event(start+narrationSeconds(s),false,s.narration));
            if(p!=null)finish(s,p);
            start+=s.seconds;
        }
        list.sort(Comparator.comparingDouble(e->e.at));
        return list;
    }
}
