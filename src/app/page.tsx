import Link from 'next/link';

export default function Home() {
  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="app-logo" style={{ width: 48, height: 48, fontSize: 18, margin: '0 auto 16px' }}>DF</div>
        <div className="landing-badge">Документооборот</div>
        <h1>DocFlow</h1>
        <p>
          Единая платформа для обмена строительной документацией.
          Загружайте, проверяйте и согласовывайте документы — всё в одном месте.
        </p>
        <Link href="/admin" className="btn btn-primary">
          Войти в панель управления
        </Link>
      </div>
    </div>
  );
}
