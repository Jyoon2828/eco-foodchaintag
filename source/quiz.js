export const QUIZZES=[
  {question:'메뚜기가 벼를 먹었어요. 화살표를 어떻게 놓을까요?',choices:['메뚜기 → 벼','벼 → 메뚜기','벼 ↔ 메뚜기'],answer:1,explanation:'먹히는 생물인 벼에서 먹는 생물인 메뚜기 쪽으로 화살표를 놓아요.'},
  {question:'개구리는 메뚜기를 먹고, 뱀에게 먹혀요. 알맞은 설명은?',choices:['개구리는 먹히기만 해요','개구리는 먹기만 해요','개구리는 먹기도 하고 먹히기도 해요'],answer:2,explanation:'개구리는 메뚜기를 먹는 생물이면서 뱀에게 먹히는 생물이기도 해요.'},
  {question:'뱀 역할로 개구리를 잡았어요. 어떤 먹이관계를 경험했나요?',choices:['개구리 → 뱀','뱀 → 개구리','뱀 → 메뚜기'],answer:0,explanation:'이 놀이에서 뱀은 개구리를 먹어요. 개구리에서 뱀 쪽으로 화살표를 놓아요.'},
  {question:'이 놀이의 먹이사슬을 바르게 연결한 것은?',choices:['매 → 뱀 → 개구리 → 메뚜기 → 벼','벼 → 메뚜기 → 개구리 → 뱀 → 매','벼 → 개구리 → 메뚜기 → 매 → 뱀'],answer:1,explanation:'벼 → 메뚜기 → 개구리 → 뱀 → 매. 화살표는 먹히는 생물에서 먹는 생물 쪽이에요.'}
];
export function quizForRole(role){return QUIZZES[role]||QUIZZES[0];}
export function isCorrect(role,choice){return Number.isInteger(choice)&&choice===quizForRole(role).answer;}
