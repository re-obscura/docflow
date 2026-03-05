import Link from 'next/link';

export default function Home() {
  return (
    <div className="landing">
      <div className="landing-logo">DF</div>
      <h1>DocFlow</h1>
      <p>
        Единая платформа для обмена строительной документацией.
        Загружайте, проверяйте и согласовывайте документы — всё в одном месте.
      </p>
      <Link href="/admin" className="btn btn-primary">
        Войти в панель управления
      </Link>
    </div>
  );
}
