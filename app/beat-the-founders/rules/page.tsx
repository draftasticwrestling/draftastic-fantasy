import Link from "next/link";

export const metadata = {
  title: "Beat the Founders Contest Rules — Draftastic Fantasy",
  description: "Official rules for the Beat the Founders contest on Draftastic Fantasy.",
};

const LAST_UPDATED = "November 21, 2026";
const CONTACT_EMAIL = "draftasticwrestling@gmail.com";

export default function BeatTheFoundersRulesPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 760, margin: "0 auto", lineHeight: 1.6 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ marginBottom: 4 }}>Beat the Founders</h1>
      <p style={{ fontSize: "1.15rem", marginTop: 0, marginBottom: 12 }}>Official Contest Rules</p>
      <p style={{ color: "#666", marginTop: 0 }}>Last updated: {LAST_UPDATED}</p>
      <p style={{ color: "#444" }}>
        PLEASE READ THESE OFFICIAL RULES CAREFULLY. By participating in the Beat the Founders contest (&quot;Contest&quot;),
        you agree to be bound by these Official Rules.
      </p>

      <h2>1. Sponsor</h2>
      <p style={{ color: "#444" }}>
        The Beat the Founders Contest is sponsored and administered by:
      </p>
      <p style={{ color: "#444" }}>
        Draftastic Wrestling LLC
        <br />
        35800 Chinook St
        <br />
        Sandy, OR 97055
        <br />
        United States
      </p>
      <p style={{ color: "#444" }}>
        Website: <a href="https://draftasticprowrestling.com">https://draftasticprowrestling.com</a>
        <br />
        Contest Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <p style={{ color: "#444" }}>
        Draftastic Wrestling LLC is referred to throughout these Official Rules as the &quot;Sponsor.&quot;
      </p>

      <h2>2. Contest Overview</h2>
      <p style={{ color: "#444" }}>
        Beat the Founders is a free fantasy professional wrestling competition hosted on Draftasticprowrestling.com.
      </p>
      <p style={{ color: "#444" }}>
        Participants who won a designated Draftastic public league by the qualification deadline and received an
        invitation are eligible to compete in the Founders League against teams managed by the founders of Draftastic.
      </p>
      <p style={{ color: "#444" }}>
        The Contest consists of a regular season followed by a three-round, single-elimination playoff.
      </p>
      <p style={{ color: "#444" }}>
        The objective is to earn a playoff position, advance through the playoffs, and defeat the founders to win the
        Founders League Championship.
      </p>
      <p style={{ color: "#444" }}>
        The Contest offers one (1) cash prize of $100 USD, awarded exclusively to an eligible non-founder participant
        who wins the championship. If a founder-managed team wins the championship, no cash prize will be awarded.
      </p>

      <h2>3. Contest Dates and Schedule</h2>
      <p style={{ color: "#444" }}>Public League Qualification Deadline: November 15, 2026.</p>
      <p style={{ color: "#444" }}>
        Participants who won a designated public league on or before this date and earned an invitation to the Founders
        League are eligible to participate, subject to all other eligibility requirements.
      </p>
      <p style={{ color: "#444" }}>Founders League Start Date: November 30, 2026.</p>
      <p style={{ color: "#444" }}>Expected Competition End: WrestleMania 2027 weekend.</p>
      <p style={{ color: "#444" }}>
        WrestleMania 2027 is currently anticipated to take place April 10–11, 2027, but those dates have not yet been
        officially confirmed. The Sponsor will publish the confirmed competition schedule and final winner
        determination date once the WrestleMania schedule is announced.
      </p>
      <p style={{ color: "#444" }}>The championship matchup will conclude during WrestleMania 2027 weekend.</p>
      <p style={{ color: "#444" }}>
        Final Winner Determination Date: to be published once the WrestleMania 2027 schedule is announced.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor may make reasonable schedule adjustments if WrestleMania dates, event programming, or related
        competition scheduling changes.
      </p>

      <h2>4. Eligibility</h2>
      <p style={{ color: "#444" }}>To participate in Beat the Founders, an individual must:</p>
      <ul style={{ color: "#444" }}>
        <li>Be at least eighteen (18) years of age at the time of entry.</li>
        <li>Have won a designated Draftastic public league on or before November 15, 2026.</li>
        <li>Have received an invitation to the Founders League.</li>
        <li>Have a valid Draftastic account in good standing.</li>
        <li>Meet all applicable country and legal eligibility requirements.</li>
        <li>Agree to these Official Rules.</li>
      </ul>
      <p style={{ color: "#444" }}>
        Although Draftastic may permit individuals younger than eighteen (18) to create accounts and participate in
        other website features, individuals under eighteen (18) are not eligible to participate in Beat the Founders or
        receive its prize.
      </p>
      <p style={{ color: "#444" }}>
        The Contest is open only to residents of countries in which the Sponsor determines that participation and prize
        distribution are legally and practically permissible. The Sponsor may establish, publish, modify, or restrict
        the list of eligible countries.
      </p>
      <p style={{ color: "#444" }}>
        Employees, owners, founders, and individuals directly involved in administering the Contest may participate in
        the Founders League if authorized by the Sponsor. However, founders and individuals designated by the Sponsor
        as founder participants are not eligible to receive the cash prize.
      </p>
      <p style={{ color: "#444" }}>The Contest is void where prohibited by law.</p>

      <h2>5. No Purchase Necessary</h2>
      <p style={{ color: "#444" }}>
        NO PURCHASE, PAYMENT, DONATION, OR WAGER IS NECESSARY TO PARTICIPATE OR WIN.
      </p>
      <p style={{ color: "#444" }}>
        Participation in the Contest is free. Participants are not required to purchase a product, pay an entry fee,
        contribute to a prize pool, make a donation, or pay the Sponsor or any third party as a condition of
        participating or receiving the prize.
      </p>
      <p style={{ color: "#444" }}>The maximum total cost paid to the Sponsor to participate in the Contest is $0.00.</p>
      <p style={{ color: "#444" }}>
        Participants are responsible for their own internet access, devices, and any ordinary costs associated with
        accessing the Draftastic website. These costs are not paid to the Sponsor and are not conditions of Contest
        participation.
      </p>

      <h2>6. Public League Qualification</h2>
      <p style={{ color: "#444" }}>
        Qualification for Beat the Founders is based on winning a designated Draftastic public league on or before
        November 15, 2026.
      </p>
      <p style={{ color: "#444" }}>
        A total of seventeen (17) public league winners had earned invitations to the Founders League as of the
        qualification deadline.
      </p>
      <p style={{ color: "#444" }}>
        Only participants who earned an invitation through an eligible designated public league may enter the Founders
        League. An invitation does not override the age, residency, or other eligibility requirements in these Official
        Rules.
      </p>
      <p style={{ color: "#444" }}>
        Public league results and winners are determined using the applicable Draftastic public league format, scoring
        system, and standings.
      </p>

      <h2>7. Founders League Format</h2>
      <p style={{ color: "#444" }}>The Founders League is a head-to-head fantasy wrestling competition.</p>
      <p style={{ color: "#444" }}>
        The league will have a maximum of twenty (20) teams, including all founder-managed teams.
      </p>
      <p style={{ color: "#444" }}>
        Each team has a $150 fantasy salary cap and may roster up to thirty (30) wrestlers. Wrestlers are not exclusive,
        so more than one team may roster the same wrestler. The same salary cap and roster limit apply to every team.
      </p>
      <p style={{ color: "#444" }}>
        Each team competes under the same fantasy scoring system and league rules. Founder-managed teams are not given
        special scoring advantages, roster privileges, or other competitive benefits.
      </p>
      <p style={{ color: "#444" }}>
        Regular-season teams are paired in weekly head-to-head matchups. Each matchup is decided by the fantasy points
        earned by each team during that matchup.
      </p>
      <p style={{ color: "#444" }}>
        The team earning more fantasy points wins the matchup. If both teams earn the same number of fantasy points,
        the matchup is recorded as a tie.
      </p>
      <p style={{ color: "#444" }}>
        Regular-season standings are determined primarily by each team&apos;s win-loss-tie record.
      </p>

      <h2>8. Fantasy Scoring</h2>
      <p style={{ color: "#444" }}>
        Fantasy points are calculated using the scoring system published on the Draftastic website:{" "}
        <Link href="/how-it-works?tab=beat-the-founders">https://draftasticprowrestling.com/how-it-works</Link>
      </p>
      <p style={{ color: "#444" }}>
        The applicable scoring rules, event types, and other fantasy league settings for the Founders League are
        published on the Draftastic website. Each team may roster up to thirty (30) wrestlers within a $150 salary cap.
      </p>
      <p style={{ color: "#444" }}>
        The scoring system in effect at the start of the Founders League will govern the competition. The Sponsor may
        correct scoring errors or make adjustments necessary to maintain the integrity and accuracy of the Contest.
      </p>
      <p style={{ color: "#444" }}>
        Material scoring changes will be communicated to participants. Changes will not be applied retroactively except
        when necessary to correct an error or address an issue affecting the integrity of the competition.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor is responsible for administering and verifying official Contest scoring and standings.
      </p>

      <h2>9. Regular-Season Standings, Tiebreakers, and Playoffs</h2>
      <p style={{ color: "#444" }}>
        The regular season will continue until the scheduled conclusion of the Founders League regular-season schedule.
      </p>
      <p style={{ color: "#444" }}>
        The eight (8) teams with the highest regular-season standings will qualify for the playoffs.
      </p>
      <p style={{ color: "#444" }}>
        If two or more teams finish the regular season with identical win-loss-tie records, the following tiebreakers
        will be applied in order:
      </p>
      <ol style={{ color: "#444" }}>
        <li>
          <strong>Total Fantasy Points:</strong> The team with the higher cumulative fantasy points total during the
          regular season receives the higher standing.
        </li>
        <li>
          <strong>Head-to-Head Record:</strong> The tied teams&apos; head-to-head results will be compared. For a tie
          involving three or more teams, the combined win-loss-tie record among the tied teams will be used.
        </li>
        <li>
          <strong>Record Against Other Playoff Teams:</strong> The tied teams&apos; records against other teams that
          qualify for the playoffs will be compared, beginning with the highest-ranked playoff opponent and proceeding
          down the final playoff standings until the tie is broken. Teams involved in the tie being resolved will be
          excluded from this comparison.
        </li>
        <li>
          <strong>Random Drawing:</strong> If the preceding tiebreakers do not resolve the tie, the Sponsor will
          conduct a random drawing to determine the order.
        </li>
      </ol>
      <p style={{ color: "#444" }}>
        The same tiebreaker sequence will be used to determine playoff seeding when necessary.
      </p>
      <h3>Playoff Format</h3>
      <p style={{ color: "#444" }}>
        The playoffs consist of three (3) consecutive rounds of single-elimination competition:
      </p>
      <p style={{ color: "#444" }}>
        <strong>Round 1: Quarterfinals</strong>
      </p>
      <ul style={{ color: "#444" }}>
        <li>Seed 1 vs. Seed 8</li>
        <li>Seed 4 vs. Seed 5</li>
        <li>Seed 2 vs. Seed 7</li>
        <li>Seed 3 vs. Seed 6</li>
      </ul>
      <p style={{ color: "#444" }}>
        <strong>Round 2: Semifinals.</strong> The four quarterfinal winners advance to the semifinals. The bracket will
        be arranged so that the winner of the 1-vs-8 matchup faces the winner of the 4-vs-5 matchup, and the winner of
        the 2-vs-7 matchup faces the winner of the 3-vs-6 matchup.
      </p>
      <p style={{ color: "#444" }}>
        <strong>Round 3: Championship.</strong> The two semifinal winners advance to the Founders League Championship.
        The championship matchup will conclude during WrestleMania 2027 weekend.
      </p>
      <p style={{ color: "#444" }}>
        Each playoff matchup is determined by the fantasy points earned during that specific matchup.
      </p>
      <p style={{ color: "#444" }}>Regular-season fantasy points do not carry over into playoff matchups.</p>
      <p style={{ color: "#444" }}>If a playoff matchup ends in a tie, the higher-seeded team advances.</p>
      <p style={{ color: "#444" }}>
        The winner of the championship matchup is the Founders League Champion. The cash prize eligibility requirements
        in Section 10 determine whether the champion receives the cash prize.
      </p>

      <h2>10. Prize</h2>
      <p style={{ color: "#444" }}>There is one (1) cash prize available for the Contest:</p>
      <p style={{ color: "#444" }}>One $100 USD cash prize.</p>
      <p style={{ color: "#444" }}>
        The $100 cash prize will be awarded exclusively to the eligible non-founder participant who wins the Founders
        League Championship.
      </p>
      <p style={{ color: "#444" }}>
        To receive the prize, a participant must advance through the playoffs and win the championship matchup against
        the opposing finalist. Finishing in second place or being the highest-ranked non-founder participant is not
        sufficient to qualify for the prize.
      </p>
      <p style={{ color: "#444" }}>
        Founder-managed teams are eligible to win the Founders League Championship and retain the championship title
        and associated bragging rights. However, founders and individuals designated by the Sponsor as founder
        participants are not eligible to receive the cash prize.
      </p>
      <p style={{ color: "#444" }}>
        If a founder-managed team wins the championship, no cash prize will be awarded. The prize will not be
        transferred to the runner-up or another participant.
      </p>
      <p style={{ color: "#444" }}>
        Only one cash prize will be awarded, and the Sponsor is not obligated to award the prize if no eligible
        non-founder participant wins the championship.
      </p>
      <p style={{ color: "#444" }}>
        The prize is non-transferable and may not be exchanged for another prize or additional compensation. The
        Sponsor reserves the right to substitute a prize of equal or greater value if the advertised prize becomes
        unavailable for reasons beyond the Sponsor&apos;s reasonable control.
      </p>
      <p style={{ color: "#444" }}>
        The winner is responsible for any taxes, duties, or other obligations associated with accepting the prize,
        except for taxes the Sponsor is legally required to pay. The Sponsor may request tax documentation and may
        withhold amounts when required by applicable law.
      </p>

      <h2>11. Prize Notification and Claim</h2>
      <p style={{ color: "#444" }}>
        The Sponsor will determine the prize winner after the championship matchup has concluded and the final scoring
        and standings have been reviewed.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor will attempt to notify the prize winner using the email address associated with the winner&apos;s
        Draftastic account.
      </p>
      <p style={{ color: "#444" }}>
        The potential winner must respond and claim the prize within thirty (30) calendar days of the Sponsor&apos;s
        initial prize notification.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor may require the potential winner to provide reasonable information to verify identity, age,
        residency, eligibility, and payment details.
      </p>
      <p style={{ color: "#444" }}>If the potential winner:</p>
      <ul style={{ color: "#444" }}>
        <li>Does not respond within thirty (30) calendar days;</li>
        <li>Cannot be contacted using the account information provided;</li>
        <li>Fails to provide requested verification information;</li>
        <li>Is determined to be ineligible; or</li>
        <li>Declines or forfeits the prize,</li>
      </ul>
      <p style={{ color: "#444" }}>
        the Sponsor may treat the prize as unclaimed. Because the prize is awarded exclusively to the eligible
        non-founder championship winner, the Sponsor is not required to award it to the runner-up or another
        participant.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor&apos;s eligibility and winner verification must be completed before the prize is paid.
      </p>

      <h2>12. Prize Payment Method</h2>
      <p style={{ color: "#444" }}>
        The $100 USD prize will be awarded using PayPal Business Payouts whenever reasonably available and appropriate.
      </p>
      <p style={{ color: "#444" }}>
        However, Draftastic Wrestling LLC reserves the right to use another reputable electronic payment service or
        payment method if PayPal is unavailable, cannot process the payment, is not supported in the winner&apos;s
        country, or is otherwise unsuitable for the transaction.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor will determine the payment method in its reasonable discretion and will communicate the available
        payment arrangements to the winner. The winner may be required to provide information reasonably necessary to
        verify their identity and eligibility and to complete the payment.
      </p>
      <p style={{ color: "#444" }}>
        The prize remains $100 USD regardless of the payment method used. If the payment provider converts the prize
        into another currency, the amount received may reflect the provider&apos;s applicable exchange rate.
      </p>
      <p style={{ color: "#444" }}>The Sponsor will not require the winner to pay a fee to the Sponsor to claim the prize.</p>
      <p style={{ color: "#444" }}>
        The Sponsor will make reasonable efforts to issue payment within fifteen (15) business days after the winner
        has completed all required verification and payment steps.
      </p>
      <p style={{ color: "#444" }}>
        If a payment method is unavailable or unsuitable, the Sponsor will work with the winner to arrange an
        alternative reasonable payment method.
      </p>

      <h2>13. Scoring Disputes</h2>
      <p style={{ color: "#444" }}>
        Participants are responsible for reviewing their team scores, matchup results, and league standings.
      </p>
      <p style={{ color: "#444" }}>
        A participant who believes a scoring or standings error has occurred must submit a dispute to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> within seven (7) calendar days after the applicable
        scores or standings are posted.
      </p>
      <p style={{ color: "#444" }}>The dispute should include:</p>
      <ul style={{ color: "#444" }}>
        <li>The participant&apos;s Draftastic account or team name;</li>
        <li>The applicable matchup or scoring period;</li>
        <li>The specific score, statistic, or result being disputed; and</li>
        <li>An explanation of the alleged error, including supporting information when available.</li>
      </ul>
      <p style={{ color: "#444" }}>
        The Sponsor will review submitted disputes and determine whether a correction is warranted.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor may correct scoring or standings errors discovered independently of a participant dispute when
        necessary to maintain accurate results and fair competition.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor&apos;s determination following review will be final for Contest administration purposes.
      </p>

      <h2>14. Fair Play and Disqualification</h2>
      <p style={{ color: "#444" }}>
        Participants must compete fairly and comply with these Official Rules and the Draftastic Terms of Service.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor may disqualify a participant, invalidate results, or suspend or remove a team from the Founders
        League if the Sponsor reasonably determines that the participant has:
      </p>
      <ul style={{ color: "#444" }}>
        <li>Provided false or misleading eligibility information;</li>
        <li>Used multiple accounts or identities to gain an unfair advantage;</li>
        <li>Attempted to manipulate, interfere with, or undermine Contest scoring or standings;</li>
        <li>Exploited a website error, vulnerability, or technical issue to gain an unfair advantage;</li>
        <li>Engaged in collusion, fraud, or other dishonest conduct;</li>
        <li>Violated these Official Rules or the Draftastic Terms of Service; or</li>
        <li>Engaged in conduct that threatens the integrity or proper administration of the Contest.</li>
      </ul>
      <p style={{ color: "#444" }}>
        The Sponsor may take reasonable steps to investigate suspected violations and protect the integrity of the
        competition.
      </p>

      <h2>15. Technical Issues and Interruptions</h2>
      <p style={{ color: "#444" }}>
        The Sponsor is not responsible for technical problems, interruptions, delays, or failures involving internet
        connections, devices, third-party services, hosting providers, data feeds, or other systems outside the
        Sponsor&apos;s reasonable control.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor will make reasonable efforts to maintain accurate scoring and standings and to address technical
        problems that affect the Contest.
      </p>
      <p style={{ color: "#444" }}>
        If a technical issue materially affects the competition, the Sponsor may make reasonable adjustments to
        scoring, scheduling, matchups, or other Contest operations to preserve fairness and competition integrity.
      </p>

      <h2>16. Modification, Suspension, or Cancellation</h2>
      <p style={{ color: "#444" }}>
        The Sponsor reserves the right to modify, suspend, or cancel the Contest if circumstances beyond its reasonable
        control make it necessary, including legal or regulatory requirements, technical failures, security incidents,
        changes to event scheduling, or other circumstances that materially affect the Contest.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor will make reasonable efforts to communicate material changes to participants.
      </p>
      <p style={{ color: "#444" }}>
        If the Contest must be cancelled after competition has begun, the Sponsor will determine a reasonable and fair
        method for resolving the Contest and any prize obligations, consistent with applicable law.
      </p>
      <p style={{ color: "#444" }}>
        Nothing in this section permits the Sponsor to arbitrarily withhold a prize that has already been validly
        earned and claimed under these Official Rules.
      </p>

      <h2>17. Privacy and Personal Information</h2>
      <p style={{ color: "#444" }}>
        Participation in Beat the Founders is subject to the Draftastic Privacy Policy:{" "}
        <Link href="/privacy">https://draftasticprowrestling.com/privacy</Link>
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor may collect and use information reasonably necessary to administer the Contest, verify eligibility,
        communicate with participants, resolve disputes, prevent fraud, and award the prize.
      </p>
      <p style={{ color: "#444" }}>
        Prize administration may require the collection of additional information from a potential winner, including
        legal name, age or date of birth, country of residence, payment information, identity verification information,
        and tax documentation when required.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor may share information reasonably necessary to administer the prize with payment providers, identity
        verification providers, tax professionals, and other service providers involved in prize administration, or as
        otherwise required by law.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor will handle personal information in accordance with its Privacy Policy and applicable law.
      </p>

      <h2>18. Limitation of Liability</h2>
      <p style={{ color: "#444" }}>
        To the maximum extent permitted by applicable law, the Sponsor and its owners, members, employees, contractors,
        and representatives are not responsible for:
      </p>
      <ul style={{ color: "#444" }}>
        <li>Technical failures, interruptions, or errors affecting website access or Contest participation;</li>
        <li>Inaccurate or delayed third-party wrestling event information or statistics;</li>
        <li>Unauthorized access to participant accounts resulting from circumstances outside the Sponsor&apos;s reasonable control;</li>
        <li>Lost, delayed, misdirected, or inaccessible communications;</li>
        <li>Payment processing delays or failures caused by third-party payment providers; or</li>
        <li>Any indirect, incidental, special, or consequential damages arising from participation in the Contest.</li>
      </ul>
      <p style={{ color: "#444" }}>
        Nothing in these Official Rules excludes or limits liability that cannot legally be excluded or limited under
        applicable law.
      </p>

      <h2>19. Governing Law and Disputes</h2>
      <p style={{ color: "#444" }}>
        These Official Rules are governed by the laws of the State of Oregon, without regard to conflict-of-law
        principles, except where applicable law requires otherwise.
      </p>
      <p style={{ color: "#444" }}>
        Any dispute concerning the Contest will be subject to applicable federal, state, and local laws and the
        jurisdiction of courts with authority over the matter.
      </p>
      <p style={{ color: "#444" }}>Nothing in these Official Rules limits rights or remedies that cannot legally be waived.</p>

      <h2>20. General Conditions</h2>
      <p style={{ color: "#444" }}>
        These Official Rules, together with the applicable Draftastic Terms of Service and Privacy Policy, govern
        participation in Beat the Founders.
      </p>
      <p style={{ color: "#444" }}>
        In the event of a conflict between these Official Rules and the general website policies regarding the specific
        Contest, these Official Rules will control with respect to Contest administration, eligibility, standings, and
        prize awards, to the extent permitted by applicable law.
      </p>
      <p style={{ color: "#444" }}>
        The Draftastic Terms of Service remain applicable to general use of the website and participant accounts.
      </p>
      <p style={{ color: "#444" }}>
        Official website policies:
        <br />
        Terms of Service: <Link href="/terms">https://draftasticprowrestling.com/terms</Link>
        <br />
        Privacy Policy: <Link href="/privacy">https://draftasticprowrestling.com/privacy</Link>
      </p>
      <p style={{ color: "#444" }}>
        If any provision of these Official Rules is found to be invalid or unenforceable, the remaining provisions will
        remain in effect to the extent permitted by law.
      </p>

      <h2>21. No Affiliation with WWE or Other Wrestling Promotions</h2>
      <p style={{ color: "#444" }}>
        Beat the Founders is an independent fantasy wrestling competition operated by Draftastic Wrestling LLC.
      </p>
      <p style={{ color: "#444" }}>
        The Contest is not sponsored, endorsed, administered by, or affiliated with WWE or any other professional
        wrestling promotion.
      </p>
      <p style={{ color: "#444" }}>
        All wrestling promotion names, trademarks, logos, and related intellectual property belong to their respective
        owners.
      </p>

      <h2>22. Sponsor&apos;s Authority</h2>
      <p style={{ color: "#444" }}>
        The Sponsor is responsible for administering the Contest and interpreting these Official Rules.
      </p>
      <p style={{ color: "#444" }}>
        The Sponsor&apos;s decisions regarding eligibility, scoring corrections, standings, playoff advancement, and
        prize verification will be final for Contest administration purposes, subject to applicable law.
      </p>
      <p style={{ color: "#444" }}>
        By participating in Beat the Founders, each participant acknowledges that they have read, understood, and
        agreed to these Official Rules.
      </p>
    </main>
  );
}
