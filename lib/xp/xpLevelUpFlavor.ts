/**
 * Long-form copy shown when a user reaches each XP level (league home banner).
 * Order matches `XP_LEVELS` (level 1 = index 0).
 */
export type LevelUpCelebration = {
  level: number;
  title: string;
  label: string;
  flavor: string;
};

const FLAVORS: readonly string[] = [
  "Congrats, rookie. You officially exist. Nobody knows your name, nobody cares about your picks, and the veterans already muted you. Grab a mop, clean the locker room toilets, and maybe someday you'll matter.",
  "You survived long enough to become slightly useful. Your reward? More unpaid work. The vets still treat you like human spam, but at least you're allowed near the catering table now.",
  "Look at you, showing up to lose in under three minutes. The crowd still doesn't know your name, but your mom probably does, and honestly that's progress.",
  "You're making other players look amazing. Unfortunately, nobody remembers the guy getting squashed. Keep grinding, enhancement boy.",
  "Congratulations on becoming fantasy wrestling's favorite punching bag. You lose so often people think it's part of your gimmick.",
  "You've escaped complete irrelevance. Barely. The buzz is small, the confidence is shaky, but at least people stopped calling security when you log in.",
  "You're consistently showing up now. Nobody watching at home cares, but the hardcore sickos in the cheap seats are starting to notice.",
  "You may not be winning titles, but the boys backstage respect your hustle. Mostly because you help carry tables after the show.",
  "You finally made the card. Sure, everyone's still buying snacks during your matches, but technically you're part of the show.",
  "You're putting in the work every week. Wins, losses, chaos… you're surviving the trenches while lesser players rage quit.",
  "People are finally whispering your name backstage. Some think you've got potential. Others think it's a fluke. Time to prove them wrong.",
  "The crowd is starting to react when you show up. Could this be your breakout run… or are you about to choke under pressure?",
  "You know how to get people going now. Sure, they're not chanting your name yet, but they stopped checking their phones during your matches.",
  "You're reliable. Dependable. A good hand. Which is wrestling code for \"not quite important enough yet.\"",
  "You've earned respect. The rookies look up to you, the veterans trust you, and the trolls hate playing against you.",
  "You show up every day and put on bangers. While others crumble under pressure, you just keep stacking XP like a machine.",
  "You're officially part of the weekly conversation now. Your takes matter. Your predictions hit. Your rivals are paying attention.",
  "You own the middle of the card. You may not headline yet, but you're impossible to ignore.",
  "The people are behind you now. Every win gets cheers. Every loss starts arguments. You've built a following.",
  "Love you or hate you, people can't stop talking about you. You've mastered the art of making the timeline furious.",
  "The rocket is strapped to your back now. Everyone sees the potential. The only question is whether you can survive the spotlight.",
  "Every room you enter becomes your room. Other players may have titles, but you've got attention.",
  "You're dangerous on the mic now. One post from you can start feuds, end careers, or burn the whole community down.",
  "You don't just compete anymore. You create rivalries people remember. Drama follows you everywhere.",
  "You're knocking on the door now. One huge run away from superstardom. The pressure just got real.",
  "The main event scene tried to keep you out. Too bad you kicked the door off the hinges.",
  "You're right there. The lights are brighter, the stakes are higher, and everyone's wondering if you're truly built for this.",
  "Congratulations. You've officially arrived. The show doesn't start until your music hits.",
  "People log in hoping to see you lose. Instead, you keep delivering. That's superstar energy.",
  "You're not just respected anymore. You set the tone. The rookies follow your lead whether they admit it or not.",
  "You are the centerpiece now. Posters, promos, debates… your name carries the company.",
  "Management trusts you. Fans depend on you. Haters despise you. Sounds like you're doing something right.",
  "You move numbers. Engagement spikes when you show up. People pay attention because you make things happen.",
  "Big stage? Big pressure? Big moments? That's your territory now.",
  "You're no longer chasing relevance. You're chasing gold. And honestly… you look dangerous.",
  "Champions are checking over their shoulder when your name appears. The hunt is officially on.",
  "You climbed the mountain. You survived the wars. You earned the crown. Everybody else is playing for second place now.",
  "You're not just holding the title. You're running through the competition like a final boss.",
  "This place revolves around you now. Your rise became the story of the entire league.",
  "Players will measure themselves against your run for years. You didn't join an era… you created one.",
  "At this point, the only debate is how big your Hall of Fame speech will be.",
  "You've reached myth status. New players hear stories about your runs before they even sign up.",
  "Your name alone carries weight now. One appearance from you changes the entire landscape.",
  "Legends fade. You didn't. Your legacy is burned into fantasy wrestling history forever.",
  "There are champions… and then there's you. Your résumé reads like fantasy wrestling fan fiction.",
  "You're officially carved into the mountain. Every future player will chase what you accomplished and probably fail.",
  "You didn't just beat legends. You erased them. Careers ended trying to stop your rise.",
  "No politics. No debates. No \"what ifs.\" You are universally acknowledged greatness.",
  "The servers tremble when you log in. Rivals pray for mercy. The XP system itself fears you.",
  "10,000 XP. The peak. The summit. The throne. There is nobody above you because you destroyed everyone who tried. Future generations won't chase your level… they'll chase your legend.",
];

export function getXpLevelUpFlavor(level: number): string {
  const i = Math.trunc(level) - 1;
  if (i < 0 || i >= FLAVORS.length) return "";
  return FLAVORS[i] ?? "";
}
