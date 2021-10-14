/*
  Do not modify this file! Run npm `npm run glossary` at ROOT of this project to fetch from the Google Sheets.
  https://docs.google.com/spreadsheets/d/1x65NjykMm-XUOz98Eu_oo6ON2xspm_h0Q0M2u6UGtug/edit#gid=1287694458 
*/

export const GLOSSARY = {
  _about: {
    name: "_about",
    availability: "later",
    example: "Effect of font on crowding.",
    explanation:
      "Optional brief description of the whole experiment. Ignored, but saved with results. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must be empty.",
    type: "text",
    default: "",
  },
  _authorEmails: {
    name: "_authorEmails",
    availability: "later",
    example: "dp3@nyu.edu",
    explanation:
      "Optional, semicolon-separated email addresses of the authors.  The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must be empty.",
    type: "text",
    default: "",
  },
  _authors: {
    name: "_authors",
    availability: "later",
    example: "Denis Pelli",
    explanation:
      "Names of all the authors, separated by semicolons. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "text",
    default: "",
  },
  _consentForm: {
    name: "_consentForm",
    availability: "imminent",
    example: "adultConsent2021.txt",
    explanation:
      "The file name of your PDF (or plain-text Markdown) consent document in the folder EasyEyesResources/ConsentForms/ in your Pavlovia account. The EasyEyes.app/threshold page makes it easy to upload your consent form(s) to that folder. The preprocessor will check that a file with this name is present in your EasyEyesResources/ConsentForms folder on Pavlovia. See consent in Glossary for information about testing minors and children. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "text",
    default: "",
  },
  _dateCreated: {
    name: "_dateCreated",
    availability: "later",
    example: "8/1/2021",
    explanation:
      "Optional date of creation. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "date",
    default: "",
  },
  _dateModified: {
    name: "_dateModified",
    availability: "later",
    example: "8/15/2021",
    explanation:
      "Optional date of latest modification. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "date",
    default: "",
  },
  _experimentName: {
    name: "_experimentName",
    availability: "later",
    example: "font",
    explanation:
      "Very important. If omitted, as default we use the table file name (without extension) as the experiment name. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "text",
    default: "",
  },
  _invitePartingCommentsBool: {
    name: "_invitePartingCommentsBool",
    availability: "imminent",
    example: "FALSE",
    explanation:
      "At the end of the experiment, invite the participant to make parting comments. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "boolean",
    default: "FALSE",
  },
  _participantDurationMinutes: {
    name: "_participantDurationMinutes",
    availability: "later",
    example: "32",
    explanation:
      "Expected duration, in minutes, in the offer to participants. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "numerical",
    default: "30",
  },
  _participantPay: {
    name: "_participantPay",
    availability: "later",
    example: "7.5",
    explanation:
      "Payment to offer to each participant. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "numerical",
    default: "7.5",
  },
  _participantPayCurrency: {
    name: "_participantPayCurrency",
    availability: "later",
    example: "USDollar",
    explanation:
      "Currency of payment amount: USDollar, Euro, etc. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "categorical",
    default: "USDollar",
    categories: ["USDollar", " Euro", " UKPound"],
  },
  _participantRecruitmentService: {
    name: "_participantRecruitmentService",
    availability: "later",
    example: "Prolific",
    explanation:
      "Name of recruitment service: none, SONA, Prolific, MTurk. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "categorical",
    default: "none",
    categories: ["none", " SONA", " Prolific", " MTurk"],
  },
  _participantRecruitmentServiceAccount: {
    name: "_participantRecruitmentServiceAccount",
    availability: "later",
    example: "123ABC",
    explanation:
      "Account number. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "text",
    default: "0",
  },
  _participantsHowMany: {
    name: "_participantsHowMany",
    availability: "later",
    example: "100",
    explanation:
      "Number of people you want to test. The leading underscore makes the pre-processor copy the value from the first condition to the rest, which must all be empty or identical.",
    type: "integer",
    default: "1",
  },
  "block                                                                                                   ":
    {
      name: "block                                                                                                   ",
      availability: "imminent",
      example: "1",
      explanation:
        "The block number. The first condition (second column) must have a block number of 0 or 1, consistent with zeroBasedNumberingBool. After the first condition, each successive condition (column) must have the same block number as the one preceding it, or increased by +1.",
      type: "integer",
      default: "0 or 1, consistent with zeroBasedNumberingBool",
    },
  conditionGroup: {
    name: "conditionGroup",
    availability: "later",
    example: "1",
    explanation:
      '"conditionGroup" imposes consistent screen markings across a set of conditions. Screen markings before and during stimulus presentation indicate the positions of the fixation and possible targets. There are many  parameters, below, whose names begin with "marking" that allow you to customize markings.  Within a block, all conditions with the same non-blank conditionGroup number are presented with the same markings (fixation cross, target X) to avoid giving any clue as to which of the possible targets will appear on this trial. Thus, one can implement uncertainty among any specified set of targets simply by creating a condition for each target, and giving all the conditions the same non-blank conditionGroup number. There can be any number of conditions in a conditionGroup, and there can be any number of condition groups in a block. Every condition belongs to a condition group. A condition with a unique conditionGroup number, or none (blank), belongs to a condition group with just that condition.',
    type: "integer",
    default: "",
  },
  conditionName: {
    name: "conditionName",
    availability: "now",
    example: "crowding",
    explanation:
      "Use this to label your condition to help guide your subsequent data analysis. Not used by EasyEyes.",
    type: "text",
    default: "",
  },
  conditionTrials: {
    name: "conditionTrials",
    availability: "now",
    example: "40",
    explanation:
      "Number of trials of this condition to run in this block. They are all randomly interleaved. Each condition can have a different number of trials. ",
    type: "integer",
    default: "35",
  },
  easyEyesTrackGazeBool: {
    name: "easyEyesTrackGazeBool",
    availability: "now",
    example: "TRUE",
    explanation:
      "Use this to turn EasyEyes gaze tracking on and off. It must be calibrated before use. Gaze tracking uses the built-in webcam to monitor where the participant's eyes are looking. To be clear, in gaze tracking, the webcam looks at your eyes to figure out where on the screen your eyes are looking. It estimates that screen location. Gaze-contingent experiments change the display based on where the participant is looking. Peripheral vision experiments typically require good fixation and may discard trials for which fixation was too far from the fixation mark. Precision is low, with a typical error of 4 deg at 50 cm. We expect the error, in deg, to be proportional to viewing distance.",
    type: "boolean",
    default: "",
  },
  easyEyesTrackHeadBool: {
    name: "easyEyesTrackHeadBool",
    availability: "now",
    example: "TRUE",
    explanation:
      "Use this to turn EasyEyes head tracking on and off. It must be calibrated before use. Head tracking uses the webcam to monitor position of the participant's head. It ignores where you're looking. The head is not a point, of course. Since this is for vision research, the point we estimate is the midpoint between the two eyes. That point is sometime called cyclopean, referring to the mythical one-eyed Cyclops in Homer's Odyssey. From each webcam image we extract: 1. the viewing distance, from the midpoint (between the two eyes) to the screen, and 2. the near point, which is the point in the plane of the screen that is closest to the midpoint between the eyes. When rendering visual stimulus specified in deg, it is necessary to take the viewing distance (and near point) into account. The near point becomes important at large eccentricities and is usually ignored at small eccentricities.",
    type: "boolean",
    default: "",
  },
  fixationCheckBool: {
    name: "fixationCheckBool",
    availability: "september",
    example: "FALSE",
    explanation:
      "Display a foveal triplet that is easy to read if the participant's eye is on fixation, and hard to read if the eye is elsewhere.",
    type: "boolean",
    default: "TRUE",
  },
  fixationLocationStrategy: {
    name: "fixationLocationStrategy",
    availability: "now",
    example: "centerFixation",
    explanation:
      'Choose the strategy by which EasyEyes should place the point of fixation, which is the origin of the visual coordinate system. This is complicated. Most experimenters will choose "centerFixation", which simply places fixation at the center of the screen. But for peripheral testing you might want to put fixation near one edge to maximize the eccentricity of a target at the other edge. To test even farther into the periphery, you might want to put fixation off-screen by putting tape on a bottle or a box and drawing a fixation cross on it. Those cases and others are handled by choosing other strategies. Fixation, whether, on- or off-screen, is always specified as a point in (x,y) pixel coordinates in the plane of the display. We never change fixation within a block, so all conditions in a block must have the same fixation point and fixationLocationStrategy. This is checked by the pre-processor. If the strategy refers to targets, we consider all possible targets across all conditions within the block.  \n• "asSpecifed" indicates that fixation is specified by (fixationLocationXScreen,  fixationLocationYScreen). \n• "centerFixation" places fixation at the center of the screen. \n• "centerTargets" sets the (possibly offscreen) fixation location so as to maximize the screen margin around the edges of all the possible targets.  \n• "centerFixationAndTargets" places fixation so as to maximize the screen margin around the fixation and the edges of all the possible targets within the block. It may be impossible to satisfy the strategies that mention targets without reducing viewing distance. Ideally, the pre-processor would flag this error before we start running the experiment.',
    type: "categorical",
    default: "centerFixation",
    categories: [
      "centerFixation",
      " centerFixationAndTargets",
      " centerTargets",
      " asSpecified",
    ],
  },
  fixationLocationXScreen: {
    name: "fixationLocationXScreen",
    availability: "imminent",
    example: "0.5",
    explanation:
      'If fixationLocationStrategy is "asSpecified" then this specifies fixation\'s X coordinate in the screen plane, normalized by screen width and height. Origin is lower left.',
    type: "numerical",
    default: "0.5",
  },
  fixationLocationYScreen: {
    name: "fixationLocationYScreen",
    availability: "imminent",
    example: "0.5",
    explanation: "As above. The Y coordinate.",
    type: "numerical",
    default: "0.5",
  },
  fixationRequestedOffscreenBool: {
    name: "fixationRequestedOffscreenBool",
    availability: "later",
    example: "FALSE",
    explanation:
      "To test the far periphery it may be worth the trouble of setting up an off-screen fixation mark, with help from the participant.",
    type: "boolean",
    default: "FALSE",
  },
  fixationToleranceDeg: {
    name: "fixationToleranceDeg",
    availability: "now",
    example: "4",
    explanation:
      "We save all trials in trialData, but when the fixation error exceeds tolerance, we don't feed it to QUEST, and we run it again by adding a trial of this condition to the list of conditions yet to be run in this block, and reshuffle that list. Excel treats 'inf' as a string, not the number infinity, so use a large number instead of 'inf'. Note that the typical error of gaze tracking using the built-in web cam is roughly 4 deg at 50 cm, so, in that case, we suggest setting tolerance no lower than 4 deg. Since accuracy is determined by webcam resolution, halving or doubling the viewing distance should proportionally change the error in estimated gaze angle.",
    type: "numerical",
    default: "1000",
  },
  flipScreenHorizontallyBool: {
    name: "flipScreenHorizontallyBool",
    availability: "later",
    example: "FALSE",
    explanation: "Needed when the display is seen through a mirror.",
    type: "boolean",
    default: "FALSE",
  },
  instructionFont: {
    name: "instructionFont",
    availability: "now",
    example: "Noto Serif",
    explanation:
      'Font used for instructions to the participant.  We recommend leaving this blank, which will result in using whatever font is recommended by the instructionTable for the chosen instructionLanguage. Currenlty our EasyEyes table recommends the Noto serif fonts. If you specify the instructionFont then specify one that can render the instructionLanguage you pick. The EasyEyes International Phrases table recommends the "Noto" fonts available from Google and Adobe at no charge. Wiki says, "Noto is a font family comprising over 100 individual fonts, which are together designed to cover all the scripts encoded in the Unicode standard." Noto serif covers all the European languages (plus Indonesian). Other Noto serif fonts cover Middle Eastern and Asian languages. https://en.wikipedia.org/wiki/Noto_fonts  I think we can download all the needed Noto fonts, convert them to WOFF2 format (using FontLab 7, which I just bought), and upload them to Pavlovia, because the Noto licenses are very unrestrictive. (Most font licenses prevent you from converting to another format or use as a webfont without specifically paying for a max number of webfont uses per month.) If the experimenter chooses the language, by setting instructionLanguage, then we upload to Pavlovia just the font needed for that language. Under our current scheme, if the participant chooses the languge, then we either upload fonts for ALL languages in advance, or upload needed fonts at runtime, after each participant choose his/her language. Alternatively, I suspect that Adobe already provides the Noto fonts on its font servers. This is free for anyone putting up a web page who has an Adobe Creative Cloud license. So then we\'d just provide the URL for the font we need. https://helpx.adobe.com/fonts/using/add-fonts-website.html \n     For European languages, I like Calibri, and one can buy the webfont from fonts.com for $49.',
    type: "text",
    default: "Verdana",
  },
  instructionLanguage: {
    name: "instructionLanguage",
    availability: "now",
    example: "Italian",
    explanation:
      "English name for the language used for instructions to the participant. ",
    type: "categorical",
    default: "English",
    categories: [""],
  },
  instructionTable: {
    name: "instructionTable",
    availability: "later",
    example: "",
    explanation:
      'The URL of a Google Sheets table of international phrases to be used to give instructions throughout the experiment. A scientist can substitute her own table, presumably a modified copy of the EasyEyes International Phrases Table. https://docs.google.com/spreadsheets/d/1UFfNikfLuo8bSromE34uWDuJrMPFiJG3VpoQKdCGkII/edit#gid=0\nThis table allows the Participant page to make all non-stimulus text international. In every place that it displays text, the Participant page looks up the mnemonic code for the needed phrase in the instruction table, to find a unicode phrase in the selected instructionLanguage (e.g. English, German, or Arabic). It\'s a Google Sheets file called "EasyEyes International Phrases".\nhttps://docs.google.com/spreadsheets/d/1AZbihlk-CP7sitLGb9yZYbmcnqQ_afjjG8h6h5UWvvo/edit#gid=0\nThe first column has mnemonic phrase names. Each of the following columns gives the corresponding text in a different language. After the first, each column represents one language. Each row is devoted to one phrase. The second row is languageNameEnglish, with values: English, German, Polish, etc. The third row is languageNameNative, with values: English, Deutsch, Polskie, etc. \n     We incorporate the latest "EasyEyes International Phrases" file when we compile threshold.js. For a particular experiment, we only need the first column (the mnemonic name) and the column whose heading matches instructionLanguage. We should copy those two columns into a Javascript dictionary, so we can easily look up each mnemonic phrase name to get the phrase in the instructionLanguage. To display any instruction, we will use the dictionary to convert a mnemonic name to a unicode phrase. \n     languageDirection. Note that most languages are left to right (LTR), and a few (e.g. Arabic, Urdu, Farsi, and Hebrew) are right to left (RTL). Text placement may need to take the direction into account. The direction (LTR or RTL) is provided by the languageDirection field.\n     languageNameNative. If we later allow the participant to choose the language, then the language selection should be based on the native language name, like Deustch or Polskie, i.e. using languageNameNative instead of languageNameEnglish.',
    type: "URL",
    default: "",
  },
  invitePartingCommentsBool: {
    name: "invitePartingCommentsBool",
    availability: "later",
    example: "FALSE",
    explanation:
      "At the end of this block, invite the participant to make parting comments. ",
    type: "boolean",
    default: "FALSE",
  },
  keyEscapeEnable: {
    name: "keyEscapeEnable",
    availability: "now",
    example: "FALSE",
    explanation:
      "If true, then, at any prompt, the participant can hit <escape> to be asked whether to cancel the trial (hit space), the block (hit return), or the whole experiment (hit escape again).",
    type: "boolean",
    default: "TRUE",
  },
  markingBlankedNearTargetBool: {
    name: "markingBlankedNearTargetBool",
    availability: "later",
    example: "TRUE",
    explanation:
      'Suppress any parts of the fixation cross or target X that are too close to the possible targets in this conditionGroup. This enables both meanings of "too close": markingBlankingRadiusReEccentricity and markingBlankingRadiusReTargetHeight.',
    type: "boolean",
    default: "TRUE",
  },
  markingBlankingRadiusReEccentricity: {
    name: "markingBlankingRadiusReEccentricity",
    availability: "later",
    example: "0.5",
    explanation:
      'Considering crowding, define "too close" distance as a fraction of radial eccentricity.',
    type: "numerical",
    default: "0.5",
  },
  markingBlankingRadiusReTargetHeight: {
    name: "markingBlankingRadiusReTargetHeight",
    availability: "later",
    example: "2",
    explanation:
      'Considering masking, define "too close" distance as a fraction of target height.',
    type: "numerical",
    default: "0.2",
  },
  markingClippedToStimulusRectBool: {
    name: "markingClippedToStimulusRectBool",
    availability: "later",
    example: "FALSE",
    explanation:
      'Fixation and target marking can be restricted (true), protecting the screen margins, or (false) allowed to extend to screen edges, a "full bleed".',
    type: "boolean",
    default: "FALSE",
  },
  markingFixationStrokeLengthDeg: {
    name: "markingFixationStrokeLengthDeg",
    availability: "later",
    example: "1",
    explanation: "Stroke length in the fixation cross.",
    type: "numerical",
    default: "1",
  },
  markingFixationStrokeThicknessDeg: {
    name: "markingFixationStrokeThicknessDeg",
    availability: "later",
    example: "0.03",
    explanation: "Stroke thickness in the fixation cross.",
    type: "numerical",
    default: "0.03",
  },
  markingOffsetBeforeTargetOnsetSecs: {
    name: "markingOffsetBeforeTargetOnsetSecs",
    availability: "now",
    example: "0.2",
    explanation:
      "Pause before target onset to minimize forward masking of the target by the preceding fixation and target markings.",
    type: "numerical",
    default: "0",
  },
  markingOnsetAfterTargetOffsetSecs: {
    name: "markingOnsetAfterTargetOffsetSecs",
    availability: "now",
    example: "0.2",
    explanation:
      "Pause before onset of fixation and target markings to minimize backward masking of the target.",
    type: "numerical",
    default: "0",
  },
  markingTargetStrokeLengthDeg: {
    name: "markingTargetStrokeLengthDeg",
    availability: "later",
    example: "1",
    explanation: "Stroke length in the target X.",
    type: "numerical",
    default: "1",
  },
  markingTargetStrokeThicknessDeg: {
    name: "markingTargetStrokeThicknessDeg",
    availability: "later",
    example: "0.03",
    explanation: "Stroke thickness in the target X.",
    type: "numerical",
    default: "0.03",
  },
  markTheFixationBool: {
    name: "markTheFixationBool",
    availability: "now",
    example: "TRUE",
    explanation: "If true, then draw a fixation cross.",
    type: "boolean",
    default: "TRUE",
  },
  markThePossibleTargetsBool: {
    name: "markThePossibleTargetsBool",
    availability: "later",
    example: "FALSE",
    explanation:
      "If true, draw an X at every possible target location, considering all conditions in this conditionGroup. ",
    type: "boolean",
    default: "FALSE",
  },
  notes: {
    name: "notes",
    availability: "now",
    example: "",
    explanation:
      "Optional. Use this to add comments about the condition that you want preserved in the data file. Ignored and saved with results.",
    type: "text",
    default: "",
  },
  playNegativeFeedbackBeepBool: {
    name: "playNegativeFeedbackBeepBool",
    availability: "now",
    example: "FALSE",
    explanation:
      "After mistaken response, play pure 500 Hz tone for 0.5 sec at amplitude 0.05. Usually we stay positive and give only positive feedback.",
    type: "boolean",
    default: "",
  },
  playPositiveFeedbackBeepBool: {
    name: "playPositiveFeedbackBeepBool",
    availability: "now",
    example: "TRUE",
    explanation:
      "After correct response, play pure 2000 Hz tone for 0.05 sec at amplitude 0.05. ",
    type: "boolean",
    default: "",
  },
  playPurrWhenReadyBool: {
    name: "playPurrWhenReadyBool",
    availability: "now",
    example: "TRUE",
    explanation:
      "Play a purring sound to alert the observer while we await their response. Pure 200 Hz tone for 0.6 sec at amplitude 1.",
    type: "boolean",
    default: "",
  },
  readingCorpusURL: {
    name: "readingCorpusURL",
    availability: "later",
    example: "http://xxx",
    explanation:
      'Book of readable text. We typically use "The phantom tollbooth" a popular American children\'s book with a reading age of 10+ years for interest and 12+ years for vocabulary. We retain punctuation, but discard chapter and paragraph breaks. Every passage selection begins and ends at a sentence break.',
    type: "text",
    default: "",
  },
  readingDefineSingleLineSpacingAs: {
    name: "readingDefineSingleLineSpacingAs",
    availability: "later",
    example: "nominal size",
    explanation:
      'What shall we say is the "single" line spacing of the text to be read? \n• "nominal size" is the industry standard, which defines single line spacing as the nominal point size at which we are rendering the font. \n• "font" defines single line spacing as the font\'s built-in line spacing, which can be enormous in fonts with large flourishes. \n• "twice x-height" defines single line spacing as twice the font\'s x-height.',
    type: "categorical",
    default: "nominal size",
    categories: ["nominal size", " font", " twice x-height", " explicit"],
  },
  readingFont: {
    name: "readingFont",
    availability: "later",
    example: "Arial",
    explanation:
      "Font name, taken from the name of font file, which may include a style.",
    type: "text",
    default: "Times New Roman",
  },
  readingFontStyle: {
    name: "readingFontStyle",
    availability: "later",
    example: "bold",
    explanation: "Font style: regular, bold, italic, bold italic",
    type: "text",
    default: "regular",
  },
  readingLinesPerPage: {
    name: "readingLinesPerPage",
    availability: "later",
    example: "8",
    explanation: "Number of lines of text per page.",
    type: "numerical",
    default: "8",
  },
  readingMaxSpacingsPerLine: {
    name: "readingMaxSpacingsPerLine",
    availability: "later",
    example: "57",
    explanation:
      "Used for line breaking. Typographers reckon that text is easiest to read in a column that is 8-10 words wide. Average English word length is 5 characters, so, counting the space between words, that's (8 to 10) *6=(48 to 60) spacings per line. Line breaking without hyphenation will produce an average line length maybe half a word less than the max, so to get an average of 9, we could use a max of 9.5, or 9.5*6=57 spacings.",
    type: "numerical",
    default: "",
  },
  readingMultipleOfSingleLineSpacing: {
    name: "readingMultipleOfSingleLineSpacing",
    availability: "later",
    example: "1.2",
    explanation:
      'Set the line spacing (measured baseline to baseline) as this multiple of "single" line spacing, which is defined by readingDefineSingleLineSpacingAs. 1.2 is the default in many typography apps, including Adobe inDesign.',
    type: "numerical",
    default: "1.2",
  },
  readingNumberOfPossibleAnswers: {
    name: "readingNumberOfPossibleAnswers",
    availability: "later",
    example: "3",
    explanation:
      "Number of possible answers for each question. Only one of the possible answers is right.",
    type: "integer",
    default: "",
  },
  readingNumberOfQuestions: {
    name: "readingNumberOfQuestions",
    availability: "later",
    example: "4",
    explanation: "Number of recall questions posed on each trial. ",
    type: "integer",
    default: "",
  },
  readingPages: {
    name: "readingPages",
    availability: "later",
    example: "5",
    explanation: "Number of pages to be read.",
    type: "numerical",
    default: "",
  },
  readingSetSizeBy: {
    name: "readingSetSizeBy",
    availability: "later",
    example: "spacing",
    explanation:
      'How do you specify the size of the text to be read?\n• "nominal" will set the point size of the text to readingNominalSizeDeg*pixPerDeg,  \n• "x-height" will adjust text size to achieve the specified x-height (the height of lowercase x),  i.e. readingXHeightDeg. \n• "spacing" will adjust the text size to achieve the specified letter-to-letter readingSpacingDeg.',
    type: "categorical",
    default: "spacing",
    categories: ["nominal", " x-height", " spacing"],
  },
  readingSingleLineSpacingDeg: {
    name: "readingSingleLineSpacingDeg",
    availability: "later",
    example: "2",
    explanation:
      'Explicit value of "single" line spacing. This is ignored unless readingDefineSingleLineSpacingAs is "explicit".',
    type: "numerical",
    default: "",
  },
  readingSpacingDeg: {
    name: "readingSpacingDeg",
    availability: "later",
    example: "0.5",
    explanation:
      'If readingSetSizeBy is "spacing", the point size of the text to be read is adjusted to make this the average center-to-center spacing (deg) of neighboring characters in words displayed. Text is displayed with the font\'s default spacing, and the point size is adjusted to achieve the requested average letter spacing.',
    type: "numerical",
    default: "",
  },
  responseClickedBool: {
    name: "responseClickedBool",
    availability: "now",
    example: "TRUE",
    explanation:
      "Allow participant to respond by clicking the target letter in the alphabet. When ready for stimulus, allow clicking fixation instead of hitting SPACE. The various response modes are not exclusive, any number from 1 to all can be enabled.",
    type: "boolean",
    default: "",
  },
  responseSpokenBool: {
    name: "responseSpokenBool",
    availability: "later",
    example: "FALSE",
    explanation:
      "Allow participant to respond by verbally naming the target. The various response modes are not exclusive, any number from 1 to all can be enabled.",
    type: "boolean",
    default: "",
  },
  responseTypedBool: {
    name: "responseTypedBool",
    availability: "now",
    example: "TRUE",
    explanation:
      "Allow participant to respond by pressing a key in keyboard. The various response modes are not exclusive, any number from 1 to all can be enabled.",
    type: "boolean",
    default: "",
  },
  responseTypedEasyEyesKeypadBool: {
    name: "responseTypedEasyEyesKeypadBool",
    availability: "imminent",
    example: "FALSE",
    explanation:
      "Allow participant to respond by pressing a key in EasyEyes keypad. The various response modes are not exclusive, any number from 1 to all can be enabled.",
    type: "boolean",
    default: "",
  },
  showAlphabetWhere: {
    name: "showAlphabetWhere",
    availability: "now",
    example: "bottom",
    explanation:
      'Can be bottom, top, left, or right. After a trial, this shows the observer the allowed responses. If the target was a letter then the possible letters are called the "alphabet". If the target is a gabor, the alphbet might display all the possible orientations, each labeled by a letter to be pressed.',
    type: "categorical",
    default: "",
    categories: ["none", " bottom", " top", " left", " right"],
  },
  showAlphabetWithLabelsBool: {
    name: "showAlphabetWithLabelsBool",
    availability: "imminent",
    example: "FALSE",
    explanation:
      "For foreign or symbol alphabets, we add Roman labels that the observer can type on an ordinary (Roman) keyboard.",
    type: "boolean",
    default: "",
  },
  showCounterWhere: {
    name: "showCounterWhere",
    availability: "now",
    example: "bottomRight",
    explanation:
      "Can be bottomLeft, bottomCenter, or bottomRight. This location is used for both the trial count AND the viewing distance. ",
    type: "categorical",
    default: "bottomRight",
    categories: ["bottomLeft", " bottomRight", " bottomCenter"],
  },
  showViewingDistanceBool: {
    name: "showViewingDistanceBool",
    availability: "now",
    example: "FALSE",
    explanation:
      'If TRUE display something like "Trial 31 of 120. Block 2 of 3. At 32 cm." (The trial and block counters appear only if showCounterBool is TRUE.) Without head tracking, this a subtle reminder to the participant of the distance they are supposed to be at. With head tracking, it\'s for debugging, allowing the experimenter to monitor the tracking of actual viewing distance. The continually changing distance display may be too distracting to show to participants, so, during data collection, we suggest turning this on only when head tracking is off.',
    type: "boolean",
    default: "FALSE",
  },
  showFixationMarkBool: {
    name: "showFixationMarkBool",
    availability: "later",
    example: "TRUE",
    explanation:
      'Whether or not to show the fixation mark. We don\'t show fixation when we cover a large area of the screen with repeated targets. See "targetRepeatsBool".',
    type: "boolean",
    default: "TRUE",
  },
  showInstructionsWhere: {
    name: "showInstructionsWhere",
    availability: "now",
    example: "topLeft",
    explanation:
      'Can be topLeft or bottomLeft. This is shown after the stimulus disappears, to instruct the participant how to respond. A typical instruction for the identification task is: "While keeping your gaze on the fixation cross, type your best guess for what middle letter was just shown." ',
    type: "categorical",
    default: "",
    categories: ["none", " topLeft", " bottomLeft"],
  },
  showProgressBarWhere: {
    name: "showProgressBarWhere",
    availability: "November",
    example: "right",
    explanation:
      "Can be none or right. Meant for children. Graphically displays a vertical green bar that tracks the trial count. The outline goes from bottom to top of the screen and it gradually fills up with green liquid, empty at zero trials, and filled to the top after the last trial of the block. Sometimes we call the green liquid spaceship fuel for Jamie the astronaut.",
    type: "categorical",
    default: "none",
    categories: ["none", " right"],
  },
  simulateParticipantBool: {
    name: "simulateParticipantBool",
    availability: "imminent",
    example: "FALSE",
    explanation:
      'Use the software model specifed by "simulationModel" to generale observer responses. The test runs without human intervention.',
    type: "boolean",
    default: "",
  },
  simulateWithDisplayBool: {
    name: "simulateWithDisplayBool",
    availability: "imminent",
    example: "TRUE",
    explanation:
      "If true, then display the stimuli as though a participant were present. This is helpful for debugging. If false, then skip display to run as fast as possible.",
    type: "boolean",
    default: "",
  },
  "​simulationLogThreshold": {
    name: "​simulationLogThreshold",
    availability: "imminent",
    example: "0",
    explanation:
      "The actual threshold of the simulated observer. We test the implementation of Quest by testing whether it correctly estimates the actual model threshold.",
    type: "numerical",
    default: "",
  },
  simulationModel: {
    name: "simulationModel",
    availability: "imminent",
    example: "blind",
    explanation:
      'For debugging and for some analyses it is often helpful to run the Threshold software with a software simulation of a human observer. "simulationModel" can be: \n• "blind": The simplest model, simply presses a random response key. \n• "ideal": This model does the same task as the human, picking the best response given the stimulus. Its threshold is a useful point of reference in analyzing human data. Without noise, it will always be right.\n• "weibull": This model gets the trial right with a probability given by a standard function that is frequently fit to human data. The QUEST staircase asssumes this model, so it should accurately measure any random threshold we assign to the model. The weibull model is as follows, in MATLAB: \nfunction response=QuestSimulate(q,tTest,tActual)\nt=tTest-tActual;\nP=q.delta*q.gamma+(1-q.delta)*(1-(1-q.gamma)*exp(-10.^(q.beta*t)));\nresponse= P > rand(1);\nend\nWhere q is a struct holding all the Weibull parameters, tTest is the stimulus intensity level (usually log of physical parameter), and tActual is the true threshold of the simulation.',
    type: "categorical",
    default: "",
    categories: ["blind", " weibull", " ideal"],
  },
  snapshotBool: {
    name: "snapshotBool",
    availability: "imminent",
    example: "FALSE",
    explanation:
      "Requests that a screen shot be recorded of the stimulus display, to be saved in the snapshot folder. Snapshots are useful for debugging, and to illustrate the stimulus in talks and papers.",
    type: "boolean",
    default: "",
  },
  spacingDeg: {
    name: "spacingDeg",
    availability: "now",
    example: "",
    explanation:
      "Center-to-center distance from target to inner flanker. Ignored if you're using Quest to measure the spacing threshold.",
    type: "numerical",
    default: "",
  },
  spacingDirection: {
    name: "spacingDirection",
    availability: "now",
    example: "radial",
    explanation:
      'When eccentricity is nonzero then the direction can be horizontal, vertical, horizontalAndVertical, radial, tangential, or radialAndTangential. When eccentricity is zero then the direction can be horizontal, vertical, or horizontalAndVertical. The "And" options display four flankers, distributed around the target. It is not allowed to request radial or tangential at eccentricity zero.',
    type: "categorical",
    default: "",
    categories: ["radial", " tangential", " horizontal", " vertical", " both"],
  },
  spacingOverSizeRatio: {
    name: "spacingOverSizeRatio",
    availability: "now",
    example: "1.4",
    explanation: "Ignored unless spacingRelationToSize is 'ratio'.",
    type: "numerical",
    default: "1.4",
  },
  spacingRelationToSize: {
    name: "spacingRelationToSize",
    availability: "now",
    example: "ratio",
    explanation:
      'spacingRelationToSize can be none, ratio, or typographic. \nWhen thresholdParameter is "spacing", spacingRelationToSize specifies how size depend on center-to-center target-flanker spacing. And when thresholdParameter is "size", spacingRelationToSize specifies how spacing depend on size. Can be none, ratio, or typographic. \n"none" means no dependence; they are set independently. \n"ratio" means accept the thresholdParameter (which is either size or spacing) and adjusts the other parameter to satisfy the specified "spacingOverSizeRatio". \n"typographic" prints the triplet (flanker, target, flanker) as a (horizontal) string (horizontally) centered on the specified target eccentricity. By "horizontal" and "vertical", we just mean the orientation of the baseline, and orthogonal to it. ("Vertically," the alphabet bounding box is centered on the eccentric location, and all letters in the string are on same baseline.) If thresholdParameter is "size" then EasyEyes adjusts the font size of the string to achieve the specified target size. If thresholdParameter is "spacing" then the font size of string is adjusted so that the width of the string is 3× specified spacing. Works with both left-to-right and right-to-left alphabets. ',
    type: "categorical",
    default: "ratio",
    categories: ["none", " ratio", " typographic"],
  },
  spacingSymmetry: {
    name: "spacingSymmetry",
    availability: "imminent",
    example: "linear",
    explanation:
      'spacingSymmetry can be log or linear. When spacing is radial, chooses equal spacing of the outer and inner flanker either on the screen ("linear") or on the cortex ("log"). The log/linear choice makes no difference when the spacingDirection is tangential, or the eccentricity is zero.',
    type: "categorical",
    default: "linear",
    categories: ["log", " linear"],
  },
  targetAlphabet: {
    name: "targetAlphabet",
    availability: "now",
    example: "DHKNORSVZ",
    explanation:
      "A string of unicode characters. On each trial, the target and flankers are randomly drawn from this alphabet, without replacement. Allowed responses are restricted to this alphabet. The other keys on the keyboard are dead. (If keyEscapeBool is true, then we also enable the escape key.)",
    type: "text",
    default: "acenorsuvxz",
  },
  targetBoundingBoxHorizontalAlignment: {
    name: "targetBoundingBoxHorizontalAlignment",
    availability: "now",
    example: "center",
    explanation:
      'When computing the alphabet bounding box as the union of the bounding box of each letter, align the bounding boxes horizontally by "center" or "origin". The bounding boxes are always vertically aligned by baseline.',
    type: "categorical",
    default: "center",
    categories: ["center", " origin"],
  },
  targetContrast: {
    name: "targetContrast",
    availability: "imminent",
    example: "-1",
    explanation:
      "Weber contrast ∆L/L0 of a letter or Michelson contrast (LMax-LMin)/(LMax+LMin) of a Gabor. A white letter is 100% contrast; a black letter is -100% contrast. Currently accurate only for 0 and ±1.",
    type: "numerical",
    default: "-1",
  },
  targetDurationSec: {
    name: "targetDurationSec",
    availability: "now",
    example: "0.15",
    explanation: "The duration of target presentation.",
    type: "numerical",
    default: "0.15",
  },
  targetEccentricityXDeg: {
    name: "targetEccentricityXDeg",
    availability: "now",
    example: "10",
    explanation:
      "The x location of the target center, relative to fixation. The target center is defined as the center of the bounding box for the letters in the targetAlphabet. (See targetBoundingBoxHorizontalAlignment.)",
    type: "numerical",
    default: "0",
  },
  targetEccentricityYDeg: {
    name: "targetEccentricityYDeg",
    availability: "now",
    example: "0",
    explanation: "The y location of the target center, relative to fixation.",
    type: "numerical",
    default: "0",
  },
  targetFont: {
    name: "targetFont",
    availability: "now",
    example: "Sloan",
    explanation:
      'The name of any font available at one of three locations: in your EasyEyesResources/Fonts/ folder on your Pavlovia account, in the browser of the participant\'s computer, or online at a given URL. \n• My folder. If the preprocessor matches targetFont with the file name of a font in your EasyEyesResources/Fonts/ folder on your Pavlovia account, then it will generate a URL to specify that font. If targetFont omits the file extension (typically woff2, woff, or otf), then matching prefers the smallest file (usually woff2). The font filename typically specifies both the font and style, so you should leave targetFontStyle at default. Otherwise the participant\'s browser might then apply an algorithm to thicken or slant what is specified by the targetFont, with results that may be surprising and unwanted. targetFontSelection must be "mineExactly". \n• My URL. Alternatively, targetFont can be the URL of an online webfont. The targetFont string must begin "https://". targetFontSelection must be "mineExactly".\n• Their browser. If there\'s no match in your Fonts folder, then the experiment will rely on runtime matching in the browser of the participant\'s computer. In this case, specify just the family name, like "Verdana", and use the "targetFontStyle" to select italic, bold, or bold-italic. Some "web safe" fonts (e.g. Arial, Verdana, Helvetica, Tahoma, Trebuchet MS, Times New Roman, Georgia, Garamond, Courier New, Brush Script MT) are available in most browsers. targetFontSelection must be either theirsExactly or theirsAllowSubstitution.\n',
    type: "text",
    default: "Times New Roman",
  },
  targetFontSelection: {
    name: "targetFontSelection",
    availability: "later",
    example: "mineExactly",
    explanation:
      'Browsers happily substitute for unavailable fonts. That\'s great for the web, but bad for perception experiments, so we allow you to indicate how flexible your font choice is, and to provide your own webfont files or links to online webfonts. If targetFont is a URL then there\'s nothing to check, and "targetFontSelection" is ignored. Before beginning the experiment, threshold.js will check availabity of each condition\'s targetFont in all the blocks in your experiment table. Each condition\'s targetFontSelection parameter specifies what\'s acceptable as a match. If there is a failure to find an acceptable match for any condition\'s targetFont in any block of the experiment, then threshold.js will cancel the whole experiment before starting the first block. In the explanations below, "mine" refers to the fonts in your EasyEyesResources/Fonts/ folder in your Pavlovia account, to which the EasyEyes.app/threshold page allows you to upload more fonts (preferably "web fonts" to save transmission time and participant-browser memory). "theirs" refers to fonts available on the future participant\'s browser. By setting targetFontSelection appropriately, you determine whether we look among just your fonts, just their fonts, or both. You can also prevent or allow font substitution by the participant\'s browser. Substitution is not recommended for collecting publishable data, but could be smart for a lecture demo that should always run, regardless. \n• "mineExactly" means use only a font from my Fonts folder that matches exactly. This is checked by the preprocessor. There are no runtime surprises. If targetFont is a URL, then use that URL.\n• "theirsExactly" means use only a font available in the participant\'s browser that matches exactly. For each participant, at the beginning of the experiment, for each condition in the experiment that specifies "theirsExactly", we compare the font selected by the participant\'s browser against your requested targetFont. The whole experiment is canceled unless the browser-selected font exactly matches your targetFont. If targetFont is a URL, flag an error.\n•  "theirsAllowSubstitution" means exclude my fonts, and accept whatever their browser gives us. In this case only, your font string can include several font names, separated by commas, to help the browser find something close to your intent. This is the usual way to select a font on the web, and never generates an error. If targetFont is a URL, flag an error.\n     The results data will record the name and style of whatever font was actually used as targetFont in each condition, and an indication of whether it came from your Fonts folder, a URL, or their browser.',
    type: "categorical",
    default: "mineExactly",
    categories: ["mineExactly", " theirsExactly", " theirsAllowSubstitution"],
  },
  targetFontStyle: {
    name: "targetFontStyle",
    availability: "later",
    example: "bold",
    explanation:
      "Can be plain (default), bold, italic, or bold-italic. \n• If targetFont is a file name that already specifies the style you want, then you should not also specify a style here. Just leave targetFontStyle as default. The problem is that the participant's browser might try to helpfully synthesize the new style by tilting or thickening what the font file produces. It's safer to switch to the font file whose name specifies the style you want. \n• Alternatively, if \"targetFont\" specifies only a font family name (e.g. Verdana), or several (e.g. Verdana;Arial), then you can use targetFontStyle to select among the four standard styles.",
    type: "text",
    default: "plain",
  },
  targetFontVariationSettings: {
    name: "targetFontVariationSettings",
    availability: "later",
    example: ' "\\"wght\\" 550, \\"ital\\" 6"',
    explanation:
      "To control a variable font, this parameter accepts a string to be assigned like this: \nmyText.style.fontVariationSettings = targetFontVariationSettings\nYou can set all the axes at once. Any axis you don't set will be set to its default. Every axis has a four-character name. Standard axes have lowercase names, e.g. 'wght'. Novel axes have ALL-UPPERCASE names. To discover your variable font's axes of variation, and their allowed ranges, try this web page:\nhttps://fontgauntlet.com/\nFor an introduction to variable fonts:\nhttps://abcdinamo.com/news/using-variable-fonts-on-the-web",
    type: "text",
    default: "",
  },
  targetFontWeight: {
    name: "targetFontWeight",
    availability: "later",
    example: "550",
    explanation:
      "To control a variable font, accepts a numerical value to be assigned like this: \nmyText.style.fontWeight = targetFontWeight\nNOTE: If you use this parameter, then EasyEyes will flag an error if determines that the targetFont is not a variable font.\nhttps://abcdinamo.com/news/using-variable-fonts-on-the-web",
    type: "numerical",
    default: "",
  },
  targetKind: {
    name: "targetKind",
    availability: "now",
    example: "letter",
    explanation:
      '• "letter" On each trial, the target is a randomly selected character from the targetAlphabet displayed in the specified targetFont and targetStyle.\n• A "gabor" (named after Dennis Gabor inventor of the laser) is the product of a Gaussian and a sinewave. As a function of space, the sinewave produces a grating, and the Gaussain vignettes it to a specific area, without introducing edges. Gabors are a popular stimulus in vision research because they have compact frequency and location.',
    type: "categorical",
    default: "letter",
    categories: ["letter", " gabor"],
  },
  targetMinimumPix: {
    name: "targetMinimumPix",
    availability: "now",
    example: "8",
    explanation:
      "Enough pixels for decent rendering of this target. This refers to size (in pixels) as specified by targetSizeIsHeightBool.",
    type: "numerical",
    default: "8",
  },
  targetRepeatsBool: {
    name: "targetRepeatsBool",
    availability: "November",
    example: "FALSE",
    explanation:
      'Display many copies of two targets, alternating across the screen. The observer reports both. Thus each presentation gets two responses, which count as two trials. David Regan and colleagues (1992) reported that in testing foveal acuity of patients with poor fixation (e.g. nystagmus) it helps to have a "repeat-letter format" eye chart covered with letters of the same size, so that no matter where the eye lands, performance is determined by the letter nearest to the point of fixation, where acuity is best. We here extend that idea to crowding. We cover some part of the screen with an alternating pattern of two letters, like a checkerboard, so that the letters can crowd each other, and ask the observer to report both letters. Again, we expect performance to be determined by the letters nearest to the (unpredictable) point of fixation, where crowding distance is least.',
    type: "boolean",
    default: "FALSE",
  },
  targetRepeatsBorderLetter: {
    name: "targetRepeatsBorderLetter",
    availability: "November",
    example: "$",
    explanation:
      "When targetRepeatsBool we use this character to create an outer border.",
    type: "text",
    default: "$",
  },
  targetRepeatsMaxLines: {
    name: "targetRepeatsMaxLines",
    availability: "November",
    example: "3",
    explanation: "Can be 1, 3, 4, … . Sarah Waugh recommends 3.",
    type: "numerical",
    default: "3",
  },
  targetRepeatsPracticeBool: {
    name: "targetRepeatsPracticeBool",
    availability: "November",
    example: "TRUE",
    explanation:
      "If targetRepeatsBool then precedes data collection by practice, as explained in note below.",
    type: "boolean",
    default: "TRUE",
  },
  targetSizeDeg: {
    name: "targetSizeDeg",
    availability: "now",
    example: "nan",
    explanation:
      "Ignored unless needed. Size is either height or width, as defined below. Height and width are based on the union of the bounding boxes of all the letters in the alphabet. ",
    type: "numerical",
    default: "?",
  },
  targetSizeIsHeightBool: {
    name: "targetSizeIsHeightBool",
    availability: "now",
    example: "FALSE",
    explanation: 'Define "size" as height (true) or width (false).',
    type: "boolean",
    default: "TRUE",
  },
  targetTask: {
    name: "targetTask",
    availability: '"identify"\n"read" later\n"detect" November',
    example: "identify",
    explanation:
      'The participant\'s task:\n• "identify" is forced choice categorization of the target among known possibilities, e.g. a letter from an alphabet or an orientation among several. \n• "read" asks the observer to read a passage of text as quickly as possible while maintaining full comprehesion, followed by a test.\n• "detect" might be added later. In yes-no detection, we simply ask "Did you see the target?". In two-alternative forced choice detection, we might display two intervals, only one of which contained the target, and ask the observer which interval had the target: 1 or 2? We rarely use detection because it needs many more trials to measure a threshold because its guessing rate is 50%, whereas identifying one of N targets has a guessing rate of only 1/N.',
    type: "categorical",
    default: "identify",
    categories: ["identify", " read"],
  },
  thresholdBeta: {
    name: "thresholdBeta",
    availability: "now",
    example: "2.3",
    explanation:
      "Used by QUEST. The steepness parameter of the Weibull psychometric function.",
    type: "numerical",
    default: "2.3",
  },
  thresholdDelta: {
    name: "thresholdDelta",
    availability: "now",
    example: "0.01",
    explanation:
      "Used by QUEST. Set the asymptote of the Weibull psychometric function to 1-delta.",
    type: "numerical",
    default: "0.01",
  },
  thresholdGuess: {
    name: "thresholdGuess",
    availability: "now",
    example: "2",
    explanation:
      "Used to prime QUEST by providing a prior PDF, which is specified as a Gaussian as a function of the log threshold parameter. Its mean is the log of your guess, and its SD (in log units) is specifed below . We typically take our guess from our standard formulas for size and spacing threshold as a function of eccentricity.",
    type: "numerical",
    default: "?",
  },
  thresholdGuessLogSd: {
    name: "thresholdGuessLogSd",
    availability: "now",
    example: "2",
    explanation:
      "Used by QUEST. Sets the standard deviation of the prior PDF as a function of log of the threshold parameter.",
    type: "numerical",
    default: "2",
  },
  thresholdParameter: {
    name: "thresholdParameter",
    availability: "now",
    example: "spacing",
    explanation:
      'The designated parameter (e.g. size or spacing) will be controlled by Quest to find the threshold at which criterion performance is attained.  \n• "spacing" to vary center-to-center spacing of target and neighboring flankers. \n• "size" to vary target size. \n• "contrast" to be added in September.\n• "eccentricity"  to be added in September.',
    type: "categorical",
    default: "spacing",
    categories: ["spacing", " size"],
  },
  thresholdProcedure: {
    name: "thresholdProcedure",
    availability: "now",
    example: "QUEST",
    explanation:
      'Can be QUEST or none. We may add Fechner\'s "method of constant stimuli". Note that when rendering we restrict the threshold parameter to values that can be rendered without artifact, i.e. not too small to have enough pixels to avoid jaggies and not too big for target (and flankers in spacing threshold) to fit entirely on screen. The response returned to QUEST is accompanied by the true value of the threshold parameter, regardless of what QUEST suggested.',
    type: "categorical",
    default: "QUEST",
    categories: ["none", " QUEST"],
  },
  thresholdProportionCorrect: {
    name: "thresholdProportionCorrect",
    availability: "now",
    example: "0.7",
    explanation:
      'Used by QUEST. This is the threshold criterion. In Methods you might say that "We defined threshold as the intensity at which the participant attained 70% correct."',
    type: "numerical",
    default: "0.7",
  },
  viewingDistanceDesiredCm: {
    name: "viewingDistanceDesiredCm",
    availability: "now",
    example: "40",
    explanation:
      "We will encourage participant to adjust their viewing distance (moving head or display) to approximate this request. If head tracking is enabled, then stimulus generation will be based on the actual viewing distance.",
    type: "numerical",
    default: "",
  },
  wirelessKeyboardNeededBool: {
    name: "wirelessKeyboardNeededBool",
    availability: "now",
    example: "FALSE",
    explanation:
      "Needed at viewing distances beyond 60 cm. Could be commercial wireless keyboard or EasyEyes keypad emulator running on any smartphone. ",
    type: "boolean",
    default: "",
  },
  zeroBasedNumberingBool: {
    name: "zeroBasedNumberingBool",
    availability: "later",
    example: "FALSE",
    explanation:
      "If true then the first block and condition are numbered 0, otherwise 1.",
    type: "boolean",
    default: "FALSE",
  },
};
