export const QUIZ_ORGANISMS={
  rice:{name:'벼',role:-1},grasshopper:{name:'메뚜기',role:0},
  frog:{name:'개구리',role:1},snake:{name:'뱀',role:2},hawk:{name:'매',role:3}
};
export const QUIZZES=[
  {question:'메뚜기가 먹는 먹이를 그림에서 골라요.',mode:'food',subject:'grasshopper',choices:['frog','rice','snake'],answer:'rice',chain:['rice','grasshopper'],explanation:'메뚜기가 벼를 먹어요.'},
  {question:'개구리가 먹는 먹이를 그림에서 골라요.',mode:'food',subject:'frog',choices:['snake','grasshopper','rice'],answer:'grasshopper',chain:['grasshopper','frog','snake'],explanation:'개구리가 메뚜기를 먹어요.'},
  {question:'이 놀이에서 개구리를 먹는 동물을 골라요.',mode:'hunter',subject:'frog',choices:['grasshopper','rice','snake'],answer:'snake',chain:['frog','snake','hawk'],explanation:'뱀이 개구리를 먹어요.'},
  {question:'이 놀이에서 뱀을 먹는 동물을 골라요.',mode:'hunter',subject:'snake',choices:['frog','hawk','grasshopper'],answer:'hawk',chain:['rice','grasshopper','frog','snake','hawk'],explanation:'매가 뱀을 먹어요.'}
];
export function quizForRole(role){return QUIZZES[role]||QUIZZES[0];}
export function isCorrect(role,choice){return typeof choice==='string'&&choice===quizForRole(role).answer;}
export class PictureQuiz{
  constructor(role){this.role=role;this.quiz=quizForRole(role);this.choice=null;this.solved=false;this.message='아래 그림을 눌러 빈자리를 채워 보세요.';}
  choose(id){
    if(this.solved||!this.quiz.choices.includes(id))return false;
    this.choice=id;this.solved=isCorrect(this.role,id);
    this.message=this.solved?'맞았어요! '+this.quiz.explanation:'다시 살펴볼까요? 실제로 먹고 먹혔던 모습을 떠올려 보세요.';
    return this.solved;
  }
}
