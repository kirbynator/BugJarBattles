import React, {useState, useEffect} from 'react'
import {
  query,
  collection,
  orderBy,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from '../firebase'
import attackLogic from './attacks'
import cleanUp from './cleanUp';

function Logic({jar, jug, area, setJar, setJug, setArea, rival, rng}) {
  const [stage, setStage] = useState('begin')
  const [convo, setConvo] = useState([])
  const [step, setStep] = useState(0)
  const [moves, setMoves] = useState([])
  const [turn, setTurn] = useState(0)
  const [timeline, setTimeline] = useState([])
  const [jarReady, setJarReady] = useState(false)
  const [jugReady, setJugReady] = useState(false)
  const [seeds, setSeeds] = useState([])
  const [death, setDeath] = useState([])

  const beginTurn = () => {
    setStage("turn")
    setStep(0)
    setConvo([])
  }

  useEffect(()=>{
    setConvo([`${rival.name} challenges you!`, `${rival.name} sends out ${jug[0].name} and ${jug[1].name}`, `You send out ${jar[0].name} and ${jar[1].name}`, beginTurn])
    setStage('begin')
  },[])

  useEffect(() => {
    const q = query(
      collection(db, `battles/${rng}/turns`),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (QuerySnapshot) => {
      const fetchedMoves = [];
      QuerySnapshot.forEach((doc) => {
        fetchedMoves.push({ ...doc.data(), id: doc.id });
      });
      setSeeds(fetchedMoves)
    });
    return () => unsubscribe;
  }, []);

  useEffect(() => {
    const sortedSeeds = seeds.filter(t=>
      t.turn === turn
    );
    if(sortedSeeds.length == 2){
      setJarReady(true)
      setJugReady(true)
      const attacks = movesArray(sortedSeeds)
      setStage('convo')
      setStep(0)
      setTimeline(attacks)
    }
  },[seeds])

  const movesArray = seed => {
    const a = seed.map(e => e.moves)
    const b = a[0].concat(a[1])
    const rocket = b.filter(c => c.move.pryo === 3).sort((q,p) => speedcalc(p) - speedcalc(q))
    const quick = b.filter(c => c.move.pryo === 2).sort((q,p) => speedcalc(p) - speedcalc(q))
    const fast = b.filter(c => c.move.pryo === 1).sort((q,p) => speedcalc(p) - speedcalc(q))
    const normal = b.filter(c => c.move.pryo === 0).sort((q,p) => speedcalc(p) - speedcalc(q))
    return rocket.concat(quick).concat(fast).concat(normal)
  }

  const speedcalc = (b) => {
    let speed = b.bug.speed
    let i = b.bug.temp?.speed
    if(!i){return speed}
    return speed * 10 * (i > 0 ? ((2 + 1) / 2) : (2 / (2 + 1)))
  }

  useEffect(()=>{
    if (timeline?.length == 4 ||  death.length > 0){
      setDeath([])
      const line = [nextLine]
      setConvo(line)
    }
  },[timeline])

  useEffect(()=>{
    setJarReady(true)
  },[jar])

  useEffect(()=>{
    setJugReady(true)
},[jug])

  const nextLine = () => {
    if (jarReady && jugReady){
      setJarReady(false)
      setJugReady(false)
      if(timeline.length === 0){ return turn % 1 != 0 ? beginTurn() : endTurn() }
      setStep(0)
      const attack = attackLogic([timeline[0]], jar, jug, area, rival.uid)
      const dialog = attack[0]
      setJar([...attack[1]])
      setJug([...attack[2]])
      setArea(attack[3])
      dialog.push(nextLine)
      setConvo(dialog)
      const newtl = timeline
      newtl.shift()
      setTimeline(newtl)
    }
  }

  const endTurn = () => {
    if (jarReady && jugReady){
      setJarReady(false)
      setJugReady(false)
      setStep(0)
      const clean = cleanUp(jar, jug, area)
      const dialog = clean[0]
      setJar([...clean[1]])
      setJug([...clean[2]])
      dialog.push(checkDeaths)
      setConvo(dialog)
      setStage()
    }
  }

  const checkDeaths = () => {
    const localTurn = turn
    setTurn(localTurn + 1)
    let deaths = []
    if(jar[0].health == 0){deaths.push(0)}
    if(jar[1].health == 0){deaths.push(1)}
    if(deaths.length > 0 && jar.filter(b=> b.health > 0).length > 1 ){
      setStep(deaths[0])
      setStage('switch')
      setDeath(deaths)
      setConvo([])
    } else if ((jug[0].health == 0 || jug[1].health == 0) && jug.filter(b=> b.health > 0).length > 1) {
      addTurn(localTurn + 1, moves)
      setStage('end')
      setDeath(['easteregg'])
      setConvo([])
    } else {
      beginTurn()
    }
  }

  const undoMove = () => {
    const new_moves = moves
    moves.pop()
    setMoves(new_moves)
    setStage('attack')
  }

  const selectedMove = m => {
    const b = jar[step]
    if (m.power || m.name === "Prevention Trap"){
      const a = moves
      const rm = {...m, random: ((Math.floor(Math.random() * 16) + 85) /100)}
      a.push({bug: b, move: rm, target: null})
      setMoves(a)
      setStage('target')
    } else {
      const a = moves
      a.push({bug: b, move: m, target: m.name == 'switch' ? m.target : step - 2, dead: death.length > 0}) 
      setMoves(a)
      setStep(death.length == 1 ? 2 : step + 1)
      setStage(step === 1 || death.length == 1  ? 'end' : 'turn') 
    }
  }

  const selectedTarget = t => {
    const a = moves
    a[a.length - 1].target = t
    setMoves(a)
    setStep(step + 1)
    setStage(step === 1 ? 'end' : 'turn')
  }

  const renderPower = (n) => {
    let power = ""
    if(n === 0) {power = "Special"}
    if(n === 1) {power = "Weak"}
    if(n === 2) {power = "Normal"}
    if(n === 3) {power = "Strong"}
    return <div style={{color:"white", background:"black"}}>{power}</div>
  }

  const sendTurn = () => {
    if(step === 2){
      const localTurn = turn
      const localMoves = moves
      setStep(3)
      addTurn(localTurn, localMoves)
    }
  }

  const addTurn = async (localTurn, localMoves) => {
    const { uid } = auth.currentUser;
    await addDoc(collection(db, `battles/${rng}/turns`), {
      moves: localMoves,
      createdAt: serverTimestamp(),
      turn: localTurn,
      area,
      uid,
    });
    setStep(0)
    setMoves([])
  }

  if (stage === "turn"){
    return (
    <div style={{width: "100%", height: "100%", border: "double"}}>
      <div style={{width: "100%", height: "10%"}}>What should {jar[step].name} do?</div>
      <div style={{width: "100%", height: "70%", display: 'flex'}}>
        <div style={{width: "50%", height: "100%", border: "solid", display: 'flex', alignItems:"center"}} onClick={()=>setStage('attack')}><h1 style={{width: "100%", textAlign:'center'}}>Attack</h1></div>
        <div style={{width: "50%", height: "100%", border: "solid", display: 'flex', alignItems:"center"}} onClick={()=>setStage('switch')}><h1 style={{textAlign:'center', width: "100%",}}>Switch</h1></div>
      </div>
      <div style={{width: "100%", height: "20%", border: "solid", display: 'flex', alignItems:"center"}}>Surrender</div>
    </div>
    )
  } else if(stage === 'attack'){
    let mount = jar[step].moves.length
    return (
      <div style={{width: "100%", height: "100%", border: "double"}}>
        <div style={{width: "100%", height: "10%"}}>What attack should {jar[step].name} do?</div>
        <div style={{width: "100%", height: "70%", display: 'flex'}}>
          <div style={{width: "50%", border: "solid", justifyContent:'center', height: mount > 2 ? "50%" : "100%"}} onClick={() => selectedMove(jar[step].moves[0])}>
            <div style={{width: "100%", display: 'flex', justifyContent:'space-around'}}>
              <div style={{width: "50%", textAlign: "center"}}>{jar[step].moves[0].name}</div>
              <div style={{width: "50%", background: "black", textAlign: "center"}}>{renderPower(jar[step].moves[0].power)}</div>
            </div>
              <br/>
            <div style={{textAlign: "center"}}>{jar[step].moves[0].info}</div>
          </div>
          <div style={{width: "50%", border: "solid", justifyContent:'center', height: mount > 2 ? "50%" : "100%"}} onClick={() => jar[step].moves[1]?.name && selectedMove(jar[step].moves[1])}>
            <div style={{width: "100%", display: 'flex', justifyContent:'space-around'}}>
              <div style={{width: "50%", textAlign: "center"}}>{jar[step].moves[1]?.name}</div>
              <div style={{width: "50%", background: "black", textAlign: "center"}}>{renderPower(jar[step].moves[1]?.power)}</div>
            </div>
              <br/>
            <div style={{textAlign: "center"}}>{jar[step].moves[1]?.info}</div>
          </div>
        </div>
        {mount > 2 && <div style={{width: "100%", height: "70%", display: 'flex'}}>
          <div style={{width: "50%", border: "solid", justifyContent:'center', height: mount > 2 ? "50%" : "100%"}} onClick={() => jar[step].moves[2]?.name && selectedMove(jar[step].moves[2])}>
            <div style={{width: "100%", display: 'flex', justifyContent:'space-around'}}>
              <div style={{width: "50%", textAlign: "center"}}>{jar[step].moves[2]?.name}</div>
              <div style={{width: "50%", background: "black", textAlign: "center"}}>{renderPower(jar[step].moves[2]?.power)}</div>
            </div>
              <br/>
            <div style={{textAlign: "center"}}>{jar[step].moves[2]?.info}</div>
          </div>
          <div style={{width: "50%", border: "solid", justifyContent:'center', height: mount > 2 ? "50%" : "100%"}} onClick={() => jar[step].moves[3]?.name && selectedMove(jar[step].moves[3])}>
            <div style={{width: "100%", display: 'flex', justifyContent:'space-around'}}>
              <div style={{width: "50%", textAlign: "center"}}>{jar[step].moves[3]?.name}</div>
              <div style={{width: "50%", background: "black", textAlign: "center"}}>{renderPower(jar[step].moves[3]?.power)}</div>
            </div>
              <br/>
            <div style={{textAlign: "center"}}>{jar[step].moves[3]?.info}</div>
          </div>
        </div>}
        <div style={{width: "100%", height: "20%", border: "solid", display: 'flex', alignItems:"center"}} onClick={()=>setStage('turn')}><div style={{textAlign: "center"}}>Back</div></div>
      </div>
      )
  }else if(stage =="switch"){
    return(
      <div style={{width: "100%", height: "100%", border: "double"}}>
        <div style={{width: "100%", height: "10%"}}>{death.length == 0 ? `Who should ${jar[step].name} switch into?` : 'Who would you like to send out' }</div>
        <div style={{width: "100%", height: "35%", display: 'flex'}}>
            <div style={{width: "50%", height: "100%", border: "solid"}} onClick={() => jar[2]?.name && selectedMove({name: 'switch', target: 2, power: 0, pryo: 3})}>{jar[2]?.name}</div>
            <div style={{width: "50%", height: "100%", border: "solid"}} onClick={() => jar[3]?.name && selectedMove({name: 'switch', target: 3, power: 0, pryo: 3})}>{jar[3]?.name}</div>
        </div>
        <div style={{width: "100%", height: "35%", display: 'flex'}}>
            <div style={{width: "50%", height: "100%", border: "solid"}} onClick={() => jar[4]?.name && selectedMove({name: 'switch', target:4, power: 0, pryo: 3})}>{jar[4]?.name}</div>
            <div style={{width: "50%", height: "100%", border: "solid"}} onClick={() => jar[5]?.name && selectedMove({name: 'switch', target:5, power: 0, pryo: 3})}>{jar[5]?.name}</div>
        </div>
        {death.length == 0 && <div style={{width: "100%", height: "20%", border: "solid", display: 'flex', alignItems:"center"}} onClick={()=>setStage('turn')}><div style={{textAlign: "center"}}>Back</div></div>}
      </div>
    )
  } else if(stage === "target") {
      return (
        <div style={{width: "100%", height: "100%", border: "double"}}>
          <div style={{width: "100%", height: "10%"}}>Who should {jar[step].name} target?</div>
          <div style={{width: "100%", height: "35%", display: 'flex'}}>
            <div style={{width: "50%", height: "100%", border: "solid"}} onClick={() => jar[0]?.name && step === 1 && selectedTarget(-1)}>{step === 1 && jar[0].name}</div>
            <div style={{width: "50%", height: "100%", border: "solid"}} onClick={() => jug[0]?.name && selectedTarget(1)}>{jug[0].name}</div>
          </div>
          <div style={{width: "100%", height: "35%", display: 'flex'}}>
            <div style={{width: "50%", height: "100%", border: "solid"}} onClick={() => jar[1]?.name && step === 0 && selectedTarget(-2)}>{step === 0 && jar[1].name}</div>
            <div style={{width: "50%", height: "100%", border: "solid"}} onClick={() => jug[0]?.name && selectedTarget(2)}>{jug[1].name}</div>
          </div>
          <div style={{width: "100%", height: "20%", border: "solid", display: 'flex', alignItems:"center"}} onClick={()=>undoMove()}><div style={{textAlign: "center"}}>Back</div></div>
        </div>
        )
  } else if (stage === "end") {
    return(
      <div style={{width: "100%", height: "100%", border: "double"}}>{step >= 2 && sendTurn()}
        <div style={{width: "100%", height: "10%"}}>Waiting on {rival.name}'s selection...</div>
      </div>
    )
  } else if (convo.length > 0) {
    return (
      <div style={{width: "100%", height: "100%", border: "double"}} onClick={() => setStep(step + 1)}>{
        typeof convo[Math.min(step, convo.length)] === "string" ? convo[Math.min(step, convo.length)] : convo[Math.min(step, convo.length)]()
      }</div>
    )
  }
}

export default Logic